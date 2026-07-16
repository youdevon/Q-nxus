import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";

export type UserNotificationRecord = {
  recipientId: string;
  notificationId: string;
  title: string;
  message: string;
  severity: string;
  moduleKey: string;
  actionUrl: string | null;
  relatedType: string | null;
  relatedId: string | null;
  status: string;
  readAt: string | null;
  createdAt: string;
  expiresAt: string | null;
};

export type UserNotificationInbox = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  unreadCount: number;
  notifications: UserNotificationRecord[];
};

export async function getUnreadNotificationCount(): Promise<number> {
  const user = await getCurrentUser();

  if (!user) {
    return 0;
  }

  return prisma.notificationRecipient.count({
    where: {
      userId: user.id,
      status: "UNREAD",
      notification: {
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: new Date(),
            },
          },
        ],
      },
    },
  });
}

export async function getUserNotifications(
  limit = 100,
  options?: { unreadOnly?: boolean },
): Promise<UserNotificationInbox | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const recipients = await prisma.notificationRecipient.findMany({
    where: {
      userId: user.id,
      ...(options?.unreadOnly ? { status: "UNREAD" as const } : {}),
    },
    orderBy: {
      notification: {
        createdAt: "desc",
      },
    },
    take: Math.max(1, Math.min(limit, 250)),
    select: {
      notificationId: true,
      status: true,
      readAt: true,
      notification: {
        select: {
          id: true,
          title: true,
          message: true,
          severity: true,
          moduleKey: true,
          actionUrl: true,
          relatedType: true,
          relatedId: true,
          createdAt: true,
          expiresAt: true,
        },
      },
    },
  });

  const notifications: UserNotificationRecord[] = recipients.map(
    (recipient) => ({
      recipientId: recipient.notificationId,
      notificationId: recipient.notification.id,
      title: recipient.notification.title,
      message: recipient.notification.message,
      severity: recipient.notification.severity,
      moduleKey: recipient.notification.moduleKey,
      actionUrl: recipient.notification.actionUrl,
      relatedType: recipient.notification.relatedType,
      relatedId: recipient.notification.relatedId,
      status: recipient.status,
      readAt: recipient.readAt?.toISOString() ?? null,
      createdAt: recipient.notification.createdAt.toISOString(),
      expiresAt: recipient.notification.expiresAt?.toISOString() ?? null,
    }),
  );

  return {
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
    },
    unreadCount: notifications.filter(
      (notification) => notification.status === "UNREAD",
    ).length,
    notifications,
  };
}
