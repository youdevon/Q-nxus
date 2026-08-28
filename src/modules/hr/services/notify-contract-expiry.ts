import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/lib/employee-position";
import { resolveRecipientsByPermissions } from "@/src/modules/notifications/lib/resolve-notification-recipients";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

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

export type ContractExpiryReminderResult = {
  considered: number;
  notified: number;
  skipped: number;
};

/**
 * Creates in-app notifications for HR/contract managers when current
 * contracts enter 30 / 60 / 90-day expiry windows. Deduplicates per
 * contract + window label within the last 14 days.
 */
export async function notifyContractExpiryReminders(): Promise<ContractExpiryReminderResult> {
  const today = startOfUtcDay();
  const windowEnd = addUtcDays(today, 90);

  const contracts = await prisma.employmentContract.findMany({
    where: {
      isCurrent: true,
      endDate: {
        not: null,
        lte: windowEnd,
      },
      status: {
        in: ["ACTIVE", "EXPIRED"],
      },
    },
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
          organizationId: true,
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
  });

  const recipientsByOrg = new Map<
    string,
    Awaited<ReturnType<typeof resolveRecipientsByPermissions>>
  >();

  async function managersForOrg(organizationId: string) {
    const cached = recipientsByOrg.get(organizationId);
    if (cached) {
      return cached;
    }
    const recipients = await resolveRecipientsByPermissions(organizationId, [
      "contracts.manage",
      "people.manage",
    ]);
    recipientsByOrg.set(organizationId, recipients);
    return recipients;
  }

  let notified = 0;
  let skipped = 0;
  const dedupeSince = addUtcDays(today, -14);

  for (const contract of contracts) {
    if (!contract.endDate) {
      skipped += 1;
      continue;
    }

    const managers = await managersForOrg(contract.employee.organizationId);

    const endIso = contract.endDate.toISOString().slice(0, 10);
    const daysUntil = Math.ceil(
      (contract.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    let windowLabel: string;

    if (daysUntil < 0) {
      windowLabel = "expired";
    } else if (daysUntil <= 30) {
      windowLabel = "within 30 days";
    } else if (daysUntil <= 60) {
      windowLabel = "within 60 days";
    } else if (daysUntil <= 90) {
      windowLabel = "within 90 days";
    } else {
      skipped += 1;
      continue;
    }

    const positionLabel =
      resolveEmployeePositionTitle({
        assignmentPositionTitle:
          contract.employee.assignments[0]?.position?.title,
        positionTitle: contract.employee.position?.title,
        contractJobTitle: contract.jobTitle,
      }) ?? contract.jobTitle;

    const contractRef = contract.contractNumber
      ? ` (${contract.contractNumber})`
      : "";
    const severity =
      daysUntil < 0 || daysUntil <= 30
        ? NotificationSeverity.WARNING
        : NotificationSeverity.INFORMATION;

    let createdAny = false;

    if (managers.length > 0) {
      const title = `Contract ${windowLabel}: ${contract.employee.firstName} ${contract.employee.lastName}`;
      const existing = await prisma.notification.findFirst({
        where: {
          relatedType: "EmploymentContract",
          relatedId: contract.id,
          title,
          createdAt: { gte: dedupeSince },
        },
        select: { id: true },
      });

      if (!existing) {
        await createSystemNotification({
          title,
          message: `${contract.employee.employeeNumber} · ${positionLabel} ends ${endIso}${contractRef}.`,
          severity,
          moduleKey: "hr",
          actionUrl: `/people/employees/${contract.employee.id}/contracts/${contract.id}`,
          relatedType: "EmploymentContract",
          relatedId: contract.id,
          recipients: managers,
        });
        createdAny = true;
      }
    }

    const employeeUser = contract.employee.user;
    if (employeeUser?.isActive) {
      const employeeTitle =
        daysUntil < 0
          ? "Your employment contract has expired"
          : `Your employment contract ends ${windowLabel}`;
      const existingEmployee = await prisma.notification.findFirst({
        where: {
          relatedType: "EmploymentContract",
          relatedId: contract.id,
          title: employeeTitle,
          createdAt: { gte: dedupeSince },
        },
        select: { id: true },
      });

      if (!existingEmployee) {
        await createSystemNotification({
          title: employeeTitle,
          message: `Your role as ${positionLabel} ends on ${endIso}${contractRef}. Contact HR if you have questions.`,
          severity,
          moduleKey: "hr",
          actionUrl: "/me/contracts",
          relatedType: "EmploymentContract",
          relatedId: contract.id,
          recipients: [
            {
              userId: employeeUser.id,
              email: employeeUser.email,
              name: `${employeeUser.firstName} ${employeeUser.lastName}`.trim(),
              sendEmail: false,
            },
          ],
        });
        createdAny = true;
      }
    }

    if (createdAny) {
      notified += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    considered: contracts.length,
    notified,
    skipped,
  };
}
