import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";
import { resolveEmployeeSupervisor } from "@/src/modules/hr/data/resolve-employee-supervisor";
import { getLeaveForfeitureSettings } from "@/src/modules/hr/data/get-leave-forfeiture-settings";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/lib/employee-position";
import type { LeaveForfeitureSettings } from "@/src/modules/hr/lib/leave-forfeiture-settings";
import {
  buildLeaveBalancesUrl,
  buildSelfLeaveForfeitureUrl,
} from "@/src/modules/hr/lib/leave-balances-url";
import {
  evaluateVacationForfeitureAlert,
  formatVacationForfeitureMessage,
  VACATION_FORFEITURE_NOTIFICATION_TITLE,
  VACATION_LEAVE_TYPE_CODE,
} from "@/src/modules/hr/lib/vacation-forfeiture";

function startOfUtcDay(value = new Date()): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type VacationForfeitureReminderResult = {
  considered: number;
  notified: number;
  skipped: number;
};

export type NotifyVacationForfeitureOptions = {
  /** When set, only evaluate this employee's current contract. */
  employeeId?: string;
  asOf?: Date;
  /** Override settings (tests). */
  settings?: LeaveForfeitureSettings;
};

async function resolveHrRecipients(
  organizationId: string,
  settings: LeaveForfeitureSettings,
): Promise<
  { id: string; email: string | null; firstName: string; lastName: string }[]
> {
  if (
    !settings.notifyLeaveManagers &&
    settings.notifyHrRoleCodes.length === 0
  ) {
    return [];
  }

  const roleOrPermissionFilters: object[] = [];

  if (settings.notifyHrRoleCodes.length > 0) {
    roleOrPermissionFilters.push({
      code: { in: settings.notifyHrRoleCodes },
    });
  }

  if (settings.notifyLeaveManagers) {
    roleOrPermissionFilters.push({
      permissions: {
        some: {
          permission: {
            code: "leave.manage",
            isActive: true,
          },
        },
      },
    });
  }

  return prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      roles: {
        some: {
          status: "ACTIVE",
          role: {
            isActive: true,
            OR: roleOrPermissionFilters,
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
}

/**
 * Creates in-app notifications when an active contract ends within 30 days
 * and the employee still has available VAC balance that cannot roll over.
 *
 * Recipients are controlled by DomainSetting `leave.forfeiture`
 * (employee, supervisor, HR role codes, leave.manage holders).
 *
 * Dedupes per contract using a stable title within 14 days.
 */
export async function notifyVacationForfeitureReminders(
  options: NotifyVacationForfeitureOptions = {},
): Promise<VacationForfeitureReminderResult> {
  const today = startOfUtcDay(options.asOf ?? new Date());
  const windowEnd = addUtcDays(today, 30);

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!organization) {
    return { considered: 0, notified: 0, skipped: 0 };
  }

  const settings =
    options.settings ?? (await getLeaveForfeitureSettings(organization.id));

  const balances = await prisma.employeeLeaveBalance.findMany({
    where: {
      ...(options.employeeId ? { employeeId: options.employeeId } : {}),
      availableBalance: {
        gt: 0,
      },
      leaveType: {
        code: VACATION_LEAVE_TYPE_CODE,
        isActive: true,
      },
      contract: {
        isCurrent: true,
        status: {
          in: ["ACTIVE", "EXPIRED"],
        },
        endDate: {
          not: null,
          lte: windowEnd,
        },
        employee: {
          organizationId: organization.id,
        },
      },
    },
    select: {
      id: true,
      availableBalance: true,
      employeeId: true,
      contractId: true,
      contract: {
        select: {
          id: true,
          endDate: true,
          contractNumber: true,
          jobTitle: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              position: {
                select: { title: true },
              },
              assignments: {
                where: { isCurrent: true },
                take: 1,
                select: {
                  position: { select: { title: true } },
                },
              },
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const hrPersonnel =
    settings.notifyLeaveManagers || settings.notifyHrRoleCodes.length > 0
      ? await resolveHrRecipients(organization.id, settings)
      : [];

  let notified = 0;
  let skipped = 0;
  const dedupeSince = addUtcDays(today, -14);

  for (const balance of balances) {
    const contract = balance.contract;
    const employee = contract.employee;
    const alert = evaluateVacationForfeitureAlert({
      availableVacation: balance.availableBalance.toString(),
      contractEndDate: contract.endDate,
      asOf: today,
    });

    if (!alert) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.notification.findFirst({
      where: {
        relatedType: "EmploymentContract",
        relatedId: contract.id,
        title: VACATION_FORFEITURE_NOTIFICATION_TITLE,
        createdAt: {
          gte: dedupeSince,
        },
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const authorityRecipients: {
      userId: string;
      email?: string | null;
      name?: string | null;
      sendEmail?: boolean;
    }[] = [];
    const seenUserIds = new Set<string>();

    function addAuthorityRecipient(input: {
      userId: string;
      email?: string | null;
      name?: string | null;
    }) {
      if (seenUserIds.has(input.userId)) {
        return;
      }

      seenUserIds.add(input.userId);
      authorityRecipients.push({
        ...input,
        sendEmail: settings.sendEmailAlerts,
      });
    }

    const employeeUser = employee.user;

    if (settings.notifySupervisor) {
      try {
        const reportingOfficer = await resolveEmployeeSupervisor(employee.id);

        if (
          reportingOfficer?.supervisorUserId &&
          reportingOfficer.supervisorUserId !== employeeUser?.id
        ) {
          addAuthorityRecipient({
            userId: reportingOfficer.supervisorUserId,
            email: reportingOfficer.supervisorUserEmail,
            name: reportingOfficer.supervisorUserName,
          });
        }
      } catch (error) {
        console.error(
          "Vacation forfeiture: reporting officer lookup failed:",
          employee.id,
          error,
        );
      }
    }

    for (const hrUser of hrPersonnel) {
      if (hrUser.id === employeeUser?.id) {
        continue;
      }

      addAuthorityRecipient({
        userId: hrUser.id,
        email: hrUser.email,
        name: `${hrUser.firstName} ${hrUser.lastName}`,
      });
    }

    const willNotifyEmployee = Boolean(
      settings.notifyEmployee && employeeUser?.isActive,
    );

    if (authorityRecipients.length === 0 && !willNotifyEmployee) {
      skipped += 1;
      continue;
    }

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const message = formatVacationForfeitureMessage(alert, {
      employeeName,
    });
    const authorityMessage = `${employee.employeeNumber} · ${
      resolveEmployeePositionTitle({
        assignmentPositionTitle: employee.assignments[0]?.position?.title,
        positionTitle: employee.position?.title,
        contractJobTitle: contract.jobTitle,
      }) ?? contract.jobTitle
    }${
      contract.contractNumber ? ` (${contract.contractNumber})` : ""
    }. ${message}`;

    const authorityBalancesUrl = buildLeaveBalancesUrl({
      employeeId: employee.id,
      focus: "forfeiture",
    });

    // Authority recipients (supervisor / HR) → People leave balances for this employee.
    if (authorityRecipients.length > 0) {
      await createSystemNotification({
        title: VACATION_FORFEITURE_NOTIFICATION_TITLE,
        message: authorityMessage,
        severity: NotificationSeverity.WARNING,
        moduleKey: "hr",
        actionUrl: authorityBalancesUrl,
        relatedType: "EmploymentContract",
        relatedId: contract.id,
        recipients: authorityRecipients,
        ...(settings.sendEmailAlerts
          ? {
              email: {
                subject: VACATION_FORFEITURE_NOTIFICATION_TITLE,
                textBody: `${authorityMessage}\n\nOpen leave balances to review entitlement, taken, and available vacation.`,
                actionLabel: "Review leave balances",
              },
            }
          : {}),
      });
    }

    // Employee self-service → My Leave (they cannot open People balances).
    if (willNotifyEmployee && employeeUser) {
      const selfMessage = formatVacationForfeitureMessage(alert);
      await createSystemNotification({
        title: VACATION_FORFEITURE_NOTIFICATION_TITLE,
        message: selfMessage,
        severity: NotificationSeverity.WARNING,
        moduleKey: "hr",
        actionUrl: buildSelfLeaveForfeitureUrl(),
        relatedType: "EmploymentContract",
        relatedId: contract.id,
        recipients: [
          {
            userId: employeeUser.id,
            email: employeeUser.email,
            name: `${employeeUser.firstName} ${employeeUser.lastName}`,
            sendEmail: settings.sendEmailAlerts,
          },
        ],
        ...(settings.sendEmailAlerts
          ? {
              email: {
                subject: VACATION_FORFEITURE_NOTIFICATION_TITLE,
                textBody: `${selfMessage}\n\nOpen My Leave to request vacation before your contract ends.`,
                actionLabel: "Open My Leave",
              },
            }
          : {}),
      });
    }

    notified += 1;
  }

  return {
    considered: balances.length,
    notified,
    skipped,
  };
}
