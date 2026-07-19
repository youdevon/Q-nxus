import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CORRESPONDENCE_BACKFILL_NOTIFICATION_TITLE,
  correspondenceNotificationIdentity,
} from "@/src/modules/hr/lib/correspondence-notification-backfill";
import { createSystemNotification } from "@/src/modules/notifications/services/create-system-notification";

export const CORRESPONDENCE_ISSUED_NOTIFICATION_TITLE =
  "New letter on your employee file";

const EXISTING_ISSUE_NOTIFICATION_TITLES = [
  CORRESPONDENCE_ISSUED_NOTIFICATION_TITLE,
  CORRESPONDENCE_BACKFILL_NOTIFICATION_TITLE,
];

function labelCategory(category: string): string {
  return category
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Notifies the employee's linked user when HR issues an employee-visible letter.
 * Idempotent: skips if an issue/backfill notification already exists for this letter.
 * Optionally queues email with a link to the self-service document.
 */
export async function notifyCorrespondenceIssued(
  correspondenceId: string,
): Promise<void> {
  const record = await prisma.employeeCorrespondence.findUnique({
    where: { id: correspondenceId },
    select: {
      id: true,
      title: true,
      category: true,
      employeeVisible: true,
      requiresAcknowledgement: true,
      status: true,
      employee: {
        select: {
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
  });

  if (
    !record ||
    record.status !== "ISSUED" ||
    !record.employeeVisible ||
    !record.employee.user?.isActive
  ) {
    return;
  }

  const user = record.employee.user;
  const identity = correspondenceNotificationIdentity(record.id);

  const existing = await prisma.notification.findFirst({
    where: {
      title: { in: EXISTING_ISSUE_NOTIFICATION_TITLES },
      OR: [
        { actionUrl: identity.actionUrl },
        {
          relatedType: identity.relatedType,
          relatedId: identity.relatedId,
        },
      ],
      recipients: {
        some: { userId: user.id },
      },
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  const categoryLabel = labelCategory(record.category);
  const acknowledgementNote = record.requiresAcknowledgement
    ? " Your acknowledgement is required."
    : "";

  await createSystemNotification({
    title: CORRESPONDENCE_ISSUED_NOTIFICATION_TITLE,
    message: `“${record.title}” (${categoryLabel}) has been added to your employee file.${acknowledgementNote}`,
    severity: record.requiresAcknowledgement
      ? NotificationSeverity.WARNING
      : NotificationSeverity.INFORMATION,
    moduleKey: "hr",
    actionUrl: identity.actionUrl,
    relatedType: identity.relatedType,
    relatedId: identity.relatedId,
    recipients: [
      {
        userId: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        sendEmail: true,
      },
    ],
    email: {
      subject: `${CORRESPONDENCE_ISSUED_NOTIFICATION_TITLE}: ${record.title}`,
      textBody: `A new letter (“${record.title}”) is available on your employee file.${acknowledgementNote}`,
      bodyHtml: `<p>A new <strong>${categoryLabel}</strong> letter titled <strong>${record.title}</strong> has been added to your employee file.${acknowledgementNote}</p>`,
      actionLabel: "View letter",
    },
  });
}
