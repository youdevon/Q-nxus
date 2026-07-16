import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
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
        },
      },
    },
  });

  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          status: "ACTIVE",
          role: {
            isActive: true,
            OR: [
              { code: "SYSTEM_ADMINISTRATOR" },
              { code: "HR_ADMINISTRATOR" },
              {
                permissions: {
                  some: {
                    permission: {
                      code: {
                        in: ["contracts.manage", "people.manage"],
                      },
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

  if (managers.length === 0) {
    return {
      considered: contracts.length,
      notified: 0,
      skipped: contracts.length,
    };
  }

  let notified = 0;
  let skipped = 0;
  const dedupeSince = addUtcDays(today, -14);

  for (const contract of contracts) {
    if (!contract.endDate) {
      skipped += 1;
      continue;
    }

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

    const title = `Contract ${windowLabel}: ${contract.employee.firstName} ${contract.employee.lastName}`;

    const existing = await prisma.notification.findFirst({
      where: {
        relatedType: "EmploymentContract",
        relatedId: contract.id,
        title,
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

    await createSystemNotification({
      title,
      message: `${contract.employee.employeeNumber} · ${contract.jobTitle} ends ${endIso}${contract.contractNumber ? ` (${contract.contractNumber})` : ""}.`,
      severity:
        daysUntil < 0 || daysUntil <= 30
          ? NotificationSeverity.WARNING
          : NotificationSeverity.INFORMATION,
      moduleKey: "hr",
      actionUrl: `/people/employees/${contract.employee.id}/contracts/${contract.id}`,
      relatedType: "EmploymentContract",
      relatedId: contract.id,
      recipients: managers.map((manager) => ({
        userId: manager.id,
        email: manager.email,
        name: `${manager.firstName} ${manager.lastName}`,
        sendEmail: false,
      })),
    });

    notified += 1;
  }

  return {
    considered: contracts.length,
    notified,
    skipped,
  };
}
