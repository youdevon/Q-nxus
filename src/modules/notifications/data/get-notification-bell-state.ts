import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import type {
  AppNotification,
  NotificationModuleSource,
} from "@/src/types/notifications";
import type { Severity } from "@/src/types/severity";

function mapSeverity(severity: string): Severity {
  switch (severity) {
    case "SUCCESS":
      return "success";
    case "WARNING":
      return "warning";
    case "ERROR":
      return "error";
    case "CRITICAL":
      return "critical";
    default:
      return "information";
  }
}

function mapModuleSource(moduleKey: string): NotificationModuleSource {
  const key = moduleKey.toLowerCase();

  switch (key) {
    case "core":
    case "hr":
    case "payroll":
    case "admin":
    case "notifications":
    case "audit":
      return key;
    default:
      return "notifications";
  }
}

export type NotificationBellState = {
  unreadCount: number;
  notifications: AppNotification[];
  /** Unread action URLs (capped) for People-section badge aggregation. */
  unreadActionUrls: Array<string | null>;
};

const ACTION_URL_CAP = 40;

/**
 * Shared bell payload for the API route (polling) and any server callers.
 * Includes recent read items so payroll approval history stays browsable
 * after actions complete.
 */
export async function getNotificationBellState(
  limit = 15,
): Promise<NotificationBellState> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      unreadCount: 0,
      notifications: [],
      unreadActionUrls: [],
    };
  }

  const now = new Date();
  const notExpired = {
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
  const unreadWhere = {
    userId: user.id,
    status: "UNREAD" as const,
    notification: notExpired,
  };

  const inboxLimit = Math.max(1, Math.min(limit, 50));

  const [unreadCount, recipients, unreadForUrls] = await Promise.all([
    prisma.notificationRecipient.count({ where: unreadWhere }),
    prisma.notificationRecipient.findMany({
      where: {
        userId: user.id,
        notification: notExpired,
      },
      orderBy: { notification: { createdAt: "desc" } },
      take: inboxLimit,
      select: {
        status: true,
        notification: {
          select: {
            id: true,
            title: true,
            message: true,
            severity: true,
            moduleKey: true,
            actionUrl: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    }),
    prisma.notificationRecipient.findMany({
      where: unreadWhere,
      orderBy: { notification: { createdAt: "desc" } },
      take: ACTION_URL_CAP,
      select: {
        notification: {
          select: {
            actionUrl: true,
          },
        },
      },
    }),
  ]);

  const nowMs = now.getTime();
  const notifications: AppNotification[] = recipients
    .filter((recipient) => {
      if (!recipient.notification.expiresAt) {
        return true;
      }
      return recipient.notification.expiresAt.getTime() > nowMs;
    })
    .map((recipient) => ({
      id: recipient.notification.id,
      title: recipient.notification.title,
      message: recipient.notification.message,
      severity: mapSeverity(recipient.notification.severity),
      moduleSource: mapModuleSource(recipient.notification.moduleKey),
      createdAt: recipient.notification.createdAt.toISOString(),
      read: recipient.status !== "UNREAD",
      href: recipient.notification.actionUrl ?? undefined,
    }));

  const unreadActionUrls = unreadForUrls.map(
    (recipient) => recipient.notification.actionUrl,
  );

  return {
    unreadCount,
    notifications,
    unreadActionUrls,
  };
}
