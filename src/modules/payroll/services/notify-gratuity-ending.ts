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

export type GratuityEndingReminderResult = {
  considered: number;
  notified: number;
  skipped: number;
};

/**
 * Remind payroll/HR when gratuity-eligible contracts enter 30/60/90-day
 * end windows (or are already past end without a PAID settlement).
 */
export async function notifyGratuityEndingReminders(): Promise<GratuityEndingReminderResult> {
  const today = startOfUtcDay();
  const windowEnd = addUtcDays(today, 90);

  const contracts = await prisma.employmentContract.findMany({
    where: {
      gratuityEligible: true,
      endDate: {
        not: null,
        lte: windowEnd,
      },
      status: {
        in: ["ACTIVE", "EXPIRED", "TERMINATED", "APPROVED", "AWAITING_SIGNATURE"],
      },
      OR: [
        { gratuitySettlement: null },
        {
          gratuitySettlement: {
            status: {
              notIn: ["PAID", "VOID", "INELIGIBLE"],
            },
          },
        },
      ],
    },
    select: {
      id: true,
      endDate: true,
      contractNumber: true,
      jobTitle: true,
      gratuityRate: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          organizationId: true,
          position: { select: { title: true } },
          assignments: {
            where: { isCurrent: true },
            take: 1,
            select: { position: { select: { title: true } } },
          },
        },
      },
      gratuitySettlement: {
        select: { status: true, netAmount: true, currency: true },
      },
    },
  });

  const recipientsByOrg = new Map<
    string,
    Awaited<ReturnType<typeof resolveRecipientsByPermissions>>
  >();

  async function recipientsForOrg(organizationId: string) {
    const cached = recipientsByOrg.get(organizationId);
    if (cached) {
      return cached;
    }
    const recipients = await resolveRecipientsByPermissions(organizationId, [
      "payroll.manage",
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

    const daysUntil = Math.ceil(
      (contract.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    let windowLabel: string;
    if (daysUntil < 0) {
      windowLabel = "overdue";
    } else if (daysUntil <= 30) {
      windowLabel = "30-day";
    } else if (daysUntil <= 60) {
      windowLabel = "60-day";
    } else {
      windowLabel = "90-day";
    }

    const relatedType = "EmploymentContractGratuity";
    const relatedId = `${contract.id}:${windowLabel}`;

    const existing = await prisma.notification.findFirst({
      where: {
        relatedType,
        relatedId,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const recipients = await recipientsForOrg(contract.employee.organizationId);
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    const positionTitle = resolveEmployeePositionTitle({
      assignmentPositionTitle:
        contract.employee.assignments[0]?.position?.title,
      positionTitle: contract.employee.position?.title,
      contractJobTitle: contract.jobTitle,
    });

    const employeeName = `${contract.employee.firstName} ${contract.employee.lastName}`;
    const endIso = contract.endDate.toISOString().slice(0, 10);
    const year = contract.endDate.getUTCFullYear();
    const settlementNote = contract.gratuitySettlement
      ? `Settlement status: ${contract.gratuitySettlement.status}.`
      : "No settlement saved yet.";

    const title =
      daysUntil < 0
        ? `Gratuity unpaid after contract end — ${employeeName}`
        : `Gratuity due soon (${windowLabel}) — ${employeeName}`;

    const message =
      daysUntil < 0
        ? `${employeeName} (${contract.employee.employeeNumber}) ended ${endIso}. ${settlementNote} Review and pay contract gratuity.`
        : `${employeeName} (${contract.employee.employeeNumber}) · ${positionTitle ?? contract.jobTitle} ends ${endIso} (${daysUntil} day${daysUntil === 1 ? "" : "s"}). ${settlementNote}`;

    await createSystemNotification({
      title,
      message,
      severity:
        daysUntil < 0
          ? NotificationSeverity.CRITICAL
          : daysUntil <= 30
            ? NotificationSeverity.WARNING
            : NotificationSeverity.INFORMATION,
      moduleKey: "payroll",
      actionUrl: `/payroll/gratuity?year=${year}&tab=unpaid`,
      relatedType,
      relatedId,
      recipients: recipients.map((row) => ({
        userId: row.userId,
        email: row.email,
        name: row.name,
        sendEmail: true,
      })),
      email: {
        subject: title,
        textBody: `${message}\n\nOpen the unpaid gratuity queue to recalculate, approve, and schedule payment.`,
        actionLabel: "Open gratuity queue",
      },
    });

    notified += 1;
  }

  return {
    considered: contracts.length,
    notified,
    skipped,
  };
}
