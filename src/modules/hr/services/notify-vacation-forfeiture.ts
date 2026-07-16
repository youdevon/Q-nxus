import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";
import { resolveEmployeeSupervisor } from "@/src/modules/hr/data/resolve-employee-supervisor";
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
};

/**
 * Creates in-app notifications when an active contract ends within 30 days
 * and the employee still has available VAC balance that cannot roll over.
 *
 * Recipients (per contract):
 * 1. Reporting officer — reporting-line supervisor via
 *    {@link resolveEmployeeSupervisor} (same as leave approval), when they
 *    have a linked active user
 * 2. Employee — when they have a linked active user
 * 3. Relevant HR — users with HR_ADMINISTRATOR role and/or leave.manage
 *    (temporary signal; exact HR roles TBD)
 *
 * Dedupes per contract using a stable title within 14 days.
 */
export async function notifyVacationForfeitureReminders(
  options: NotifyVacationForfeitureOptions = {},
): Promise<VacationForfeitureReminderResult> {
  const today = startOfUtcDay(options.asOf ?? new Date());
  const windowEnd = addUtcDays(today, 30);

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

  // TODO(future): exact HR personnel for use-or-lose alerts will be refined
  // later (named roles / org assignment). For now, a narrow leave/HR signal:
  // HR_ADMINISTRATOR role and/or leave.manage permission.
  const hrPersonnel = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          status: "ACTIVE",
          role: {
            isActive: true,
            OR: [
              { code: "HR_ADMINISTRATOR" },
              {
                permissions: {
                  some: {
                    permission: {
                      code: "leave.manage",
                      isActive: true,
                    },
                  },
                },
              },
            ],
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

    const recipients: {
      userId: string;
      email?: string | null;
      name?: string | null;
      sendEmail?: boolean;
    }[] = [];

    const employeeUser = employee.user;

    if (employeeUser?.isActive) {
      recipients.push({
        userId: employeeUser.id,
        email: employeeUser.email,
        name: `${employeeUser.firstName} ${employeeUser.lastName}`,
        sendEmail: false,
      });
    }

    try {
      // Reporting officer = position reports-to line (same resolver as leave approval).
      const reportingOfficer = await resolveEmployeeSupervisor(employee.id);

      if (
        reportingOfficer?.supervisorUserId &&
        reportingOfficer.supervisorUserId !== employeeUser?.id
      ) {
        recipients.push({
          userId: reportingOfficer.supervisorUserId,
          email: reportingOfficer.supervisorUserEmail,
          name: reportingOfficer.supervisorUserName,
          sendEmail: false,
        });
      }
    } catch (error) {
      console.error(
        "Vacation forfeiture: reporting officer lookup failed:",
        employee.id,
        error,
      );
    }

    for (const hrUser of hrPersonnel) {
      if (hrUser.id === employeeUser?.id) {
        continue;
      }

      recipients.push({
        userId: hrUser.id,
        email: hrUser.email,
        name: `${hrUser.firstName} ${hrUser.lastName}`,
        sendEmail: false,
      });
    }

    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const message = formatVacationForfeitureMessage(alert, {
      employeeName,
    });

    await createSystemNotification({
      title: VACATION_FORFEITURE_NOTIFICATION_TITLE,
      message: `${employee.employeeNumber} · ${contract.jobTitle}${
        contract.contractNumber ? ` (${contract.contractNumber})` : ""
      }. ${message}`,
      severity: NotificationSeverity.WARNING,
      moduleKey: "hr",
      actionUrl: `/leave/new`,
      relatedType: "EmploymentContract",
      relatedId: contract.id,
      recipients,
    });

    notified += 1;
  }

  return {
    considered: balances.length,
    notified,
    skipped,
  };
}
