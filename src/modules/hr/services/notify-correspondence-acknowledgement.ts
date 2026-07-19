import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";
import {
  ACKNOWLEDGEMENT_OVERDUE_DAYS,
  isAcknowledgementOverdue,
} from "@/src/modules/hr/lib/correspondence-visibility";

export const CORRESPONDENCE_ACK_REMINDER_TITLE =
  "Letter awaiting acknowledgement";

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type CorrespondenceAckReminderResult = {
  considered: number;
  notified: number;
  skipped: number;
};

export type NotifyCorrespondenceAckOptions = {
  correspondenceId?: string;
  employeeId?: string;
  /** When true, bypasses the 3-day dedupe window (HR manual reminder). */
  force?: boolean;
  asOf?: Date;
};

/**
 * Reminds employees about issued letters that still require acknowledgement.
 * Dedupes per correspondence within 3 days unless `force` is set.
 */
export async function notifyCorrespondenceAcknowledgementReminders(
  options: NotifyCorrespondenceAckOptions = {},
): Promise<CorrespondenceAckReminderResult> {
  const asOf = options.asOf ?? new Date();
  const dedupeSince = addUtcDays(asOf, -3);

  const records = await prisma.employeeCorrespondence.findMany({
    where: {
      ...(options.correspondenceId ? { id: options.correspondenceId } : {}),
      ...(options.employeeId ? { employeeId: options.employeeId } : {}),
      status: "ISSUED",
      employeeVisible: true,
      requiresAcknowledgement: true,
    },
    select: {
      id: true,
      title: true,
      issueDate: true,
      status: true,
      requiresAcknowledgement: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
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

  let notified = 0;
  let skipped = 0;

  for (const record of records) {
    const user = record.employee.user;

    if (!user?.isActive) {
      skipped += 1;
      continue;
    }

    if (!options.force) {
      const existing = await prisma.notification.findFirst({
        where: {
          relatedType: "EmployeeCorrespondence",
          relatedId: record.id,
          title: CORRESPONDENCE_ACK_REMINDER_TITLE,
          createdAt: { gte: dedupeSince },
        },
        select: { id: true },
      });

      if (existing) {
        skipped += 1;
        continue;
      }
    }

    const overdue = isAcknowledgementOverdue(
      {
        status: record.status,
        requiresAcknowledgement: record.requiresAcknowledgement,
        issueDate: record.issueDate,
      },
      asOf,
    );

    const overdueNote = overdue
      ? ` This acknowledgement is more than ${ACKNOWLEDGEMENT_OVERDUE_DAYS} days overdue.`
      : "";

    await createSystemNotification({
      title: CORRESPONDENCE_ACK_REMINDER_TITLE,
      message: `Please acknowledge “${record.title}”.${overdueNote}`,
      severity: overdue
        ? NotificationSeverity.WARNING
        : NotificationSeverity.INFORMATION,
      moduleKey: "hr",
      actionUrl: `/me/documents/${record.id}`,
      relatedType: "EmployeeCorrespondence",
      relatedId: record.id,
      recipients: [
        {
          userId: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          sendEmail: options.force,
        },
      ],
      email: options.force
        ? {
            subject: `${CORRESPONDENCE_ACK_REMINDER_TITLE}: ${record.title}`,
            textBody: `Please acknowledge the letter “${record.title}”.${overdueNote}`,
            bodyHtml: `<p>Please acknowledge the letter <strong>${record.title}</strong>.${overdueNote}</p>`,
            actionLabel: "Acknowledge letter",
          }
        : undefined,
    });

    notified += 1;
  }

  return {
    considered: records.length,
    notified,
    skipped,
  };
}
