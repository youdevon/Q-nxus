"use server";

import {
  getUnreadNotificationCount,
  getUserNotifications,
} from "@/src/modules/notifications/data/get-user-notifications";
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
};

export async function fetchNotificationBellState(
  limit = 8,
): Promise<NotificationBellState> {
  const [unreadCount, inbox] = await Promise.all([
    getUnreadNotificationCount(),
    getUserNotifications(limit, { unreadOnly: true }),
  ]);

  if (!inbox) {
    return {
      unreadCount: 0,
      notifications: [],
    };
  }

  const now = Date.now();

  const notifications: AppNotification[] = inbox.notifications
    .filter((notification) => {
      if (!notification.expiresAt) {
        return true;
      }

      return new Date(notification.expiresAt).getTime() > now;
    })
    .map((notification) => ({
      id: notification.notificationId,
      title: notification.title,
      message: notification.message,
      severity: mapSeverity(notification.severity),
      moduleSource: mapModuleSource(notification.moduleKey),
      createdAt: notification.createdAt,
      read: notification.status !== "UNREAD",
      href: notification.actionUrl ?? undefined,
    }));

  return {
    unreadCount,
    notifications,
  };
}
