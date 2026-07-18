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

const ACTION_URL_CAP = 100;

/**
 * Shared bell payload for the API route (polling) and any server callers.
 * Single unread query; inbox rows are sliced from that result.
 */
export async function getNotificationBellState(
  limit = 8,
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
  const unreadWhere = {
    userId: user.id,
    status: "UNREAD" as const,
    notification: {
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  };

  const inboxLimit = Math.max(1, Math.min(limit, 50));

  const [unreadCount, recipients] = await Promise.all([
    prisma.notificationRecipient.count({ where: unreadWhere }),
    prisma.notificationRecipient.findMany({
      where: unreadWhere,
      orderBy: { notification: { createdAt: "desc" } },
      take: Math.max(inboxLimit, ACTION_URL_CAP),
      select: {
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
  ]);

  const nowMs = now.getTime();
  const notifications: AppNotification[] = recipients
    .slice(0, inboxLimit)
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
      read: false,
      href: recipient.notification.actionUrl ?? undefined,
    }));

  const unreadActionUrls = recipients
    .slice(0, ACTION_URL_CAP)
    .map((recipient) => recipient.notification.actionUrl);

  return {
    unreadCount,
    notifications,
    unreadActionUrls,
  };
}
