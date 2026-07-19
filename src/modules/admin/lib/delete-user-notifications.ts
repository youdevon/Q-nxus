import type { Prisma } from "@/generated/prisma/client";

export type DeleteUserNotificationsResult = {
  recipientsDeleted: number;
  orphanedNotificationsDeleted: number;
};

/**
 * Removes in-app bell notifications for the given users and deletes notification
 * rows that no longer have any recipients.
 */
export async function deleteNotificationsForUsers(
  transaction: Prisma.TransactionClient,
  userIds: string[],
): Promise<DeleteUserNotificationsResult> {
  if (userIds.length === 0) {
    return {
      recipientsDeleted: 0,
      orphanedNotificationsDeleted: 0,
    };
  }

  const deletedRecipients = await transaction.notificationRecipient.deleteMany({
    where: {
      userId: {
        in: userIds,
      },
    },
  });

  const deletedNotifications = await transaction.notification.deleteMany({
    where: {
      recipients: {
        none: {},
      },
    },
  });

  return {
    recipientsDeleted: deletedRecipients.count,
    orphanedNotificationsDeleted: deletedNotifications.count,
  };
}
