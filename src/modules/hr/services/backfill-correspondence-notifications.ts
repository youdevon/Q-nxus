import { NotificationSeverity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CORRESPONDENCE_BACKFILL_NOTIFICATION_TITLE,
  correspondenceNotificationIdentity,
  historicalRecipientReadState,
} from "@/src/modules/hr/lib/correspondence-notification-backfill";

const EXISTING_ISSUE_NOTIFICATION_TITLES = [
  CORRESPONDENCE_BACKFILL_NOTIFICATION_TITLE,
  "New letter on your employee file",
];

function labelCategory(category: string): string {
  return category
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export type CorrespondenceNotificationBackfillResult = {
  considered: number;
  created: number;
  createdUnread: number;
  createdRead: number;
  skippedExisting: number;
};

/**
 * Adds notification-inbox entries for historical, employee-visible letters.
 * A per-letter/user advisory lock plus a persisted identity check makes repeat
 * and concurrent backfill runs idempotent.
 */
export async function backfillCorrespondenceNotifications(): Promise<CorrespondenceNotificationBackfillResult> {
  const records = await prisma.employeeCorrespondence.findMany({
    where: {
      employeeVisible: true,
      status: { in: ["ISSUED", "ACKNOWLEDGED"] },
      employee: {
        user: {
          is: {
            isActive: true,
          },
        },
      },
    },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      requiresAcknowledgement: true,
      acknowledgedAt: true,
      issueDate: true,
      createdAt: true,
      employee: {
        select: {
          user: {
            select: {
              id: true,
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const result: CorrespondenceNotificationBackfillResult = {
    considered: records.length,
    created: 0,
    createdUnread: 0,
    createdRead: 0,
    skippedExisting: 0,
  };

  for (const record of records) {
    const user = record.employee.user;
    const status = record.status;

    if (!user || (status !== "ISSUED" && status !== "ACKNOWLEDGED")) {
      continue;
    }

    const identity = correspondenceNotificationIdentity(record.id);
    const recipientState = historicalRecipientReadState(
      status,
      record.acknowledgedAt,
      record.issueDate ?? record.createdAt,
    );
    const categoryLabel = labelCategory(record.category);
    const acknowledgementNote =
      status === "ISSUED" && record.requiresAcknowledgement
        ? " Your acknowledgement is required."
        : "";

    const created = await prisma.$transaction(async (transaction) => {
      const lockKey = `correspondence-notification:${record.id}:${user.id}`;

      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      const existing = await transaction.notification.findFirst({
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
            some: {
              userId: user.id,
            },
          },
        },
        select: { id: true },
      });

      if (existing) {
        return false;
      }

      await transaction.notification.create({
        data: {
          title: CORRESPONDENCE_BACKFILL_NOTIFICATION_TITLE,
          message: `“${record.title}” (${categoryLabel}) is available on your employee file.${acknowledgementNote}`,
          severity:
            status === "ISSUED" && record.requiresAcknowledgement
              ? NotificationSeverity.WARNING
              : NotificationSeverity.INFORMATION,
          moduleKey: "hr",
          ...identity,
          createdAt: record.issueDate ?? record.createdAt,
          recipients: {
            create: {
              userId: user.id,
              status: recipientState.status,
              readAt: recipientState.readAt,
            },
          },
        },
      });

      return true;
    });

    if (!created) {
      result.skippedExisting += 1;
      continue;
    }

    result.created += 1;
    if (recipientState.status === "READ") {
      result.createdRead += 1;
    } else {
      result.createdUnread += 1;
    }
  }

  return result;
}
