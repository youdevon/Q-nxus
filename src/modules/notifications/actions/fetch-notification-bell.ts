"use server";

import {
  getNotificationBellState,
  type NotificationBellState,
} from "@/src/modules/notifications/data/get-notification-bell-state";

export type { NotificationBellState };

/** @deprecated Prefer GET /api/notifications/bell for client polling. */
export async function fetchNotificationBellState(
  limit = 8,
): Promise<NotificationBellState> {
  return getNotificationBellState(limit);
}
