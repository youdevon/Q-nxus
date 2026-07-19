"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  markAllNotificationsRead,
  markNotificationReadById,
} from "@/src/modules/notifications/actions/manage-user-notifications";
import type { NotificationBellState } from "@/src/modules/notifications/data/get-notification-bell-state";
import { useAuth } from "@/src/modules/auth/context/auth-provider";
import type { AppNotification } from "@/src/types/notifications";

const POLL_INTERVAL_MS = 30_000;
const BELL_ENDPOINT = "/api/notifications/bell";

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  /** Unread notification action URLs for section badge aggregation. */
  unreadActionUrls: Array<string | null>;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationContext =
  React.createContext<NotificationContextValue | null>(null);

async function fetchBellState(
  signal?: AbortSignal,
): Promise<NotificationBellState> {
  const response = await fetch(BELL_ENDPOINT, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Notification bell request failed (${response.status})`);
  }

  return (await response.json()) as NotificationBellState;
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [notifications, setNotifications] = React.useState<AppNotification[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [unreadActionUrls, setUnreadActionUrls] = React.useState<
    Array<string | null>
  >([]);
  const [isLoading, setIsLoading] = React.useState(Boolean(user));
  const refreshRequestId = React.useRef(0);
  /** Bumped on local mutations so in-flight refreshes cannot overwrite them. */
  const mutationEpoch = React.useRef(0);
  const hasLoadedOnce = React.useRef(false);
  const notificationsRef = React.useRef(notifications);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const refresh = React.useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setUnreadActionUrls([]);
      setIsLoading(false);
      hasLoadedOnce.current = false;
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = ++refreshRequestId.current;
    const epochAtStart = mutationEpoch.current;

    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    }

    try {
      const state = await fetchBellState(controller.signal);

      if (requestId !== refreshRequestId.current) {
        return;
      }

      // A mark-read happened while this request was in flight — keep optimistic UI.
      if (epochAtStart !== mutationEpoch.current) {
        return;
      }

      setNotifications(state.notifications);
      setUnreadCount(state.unreadCount);
      setUnreadActionUrls(
        Array.isArray(state.unreadActionUrls) ? state.unreadActionUrls : [],
      );
      hasLoadedOnce.current = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Failed to refresh notifications:", error);
    } finally {
      if (requestId === refreshRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [user]);

  React.useEffect(() => {
    // Defer so setState inside refresh is not synchronous within the effect body.
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      abortRef.current?.abort();
    };
  }, [refresh, pathname]);

  React.useEffect(() => {
    if (!user) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    const onFocus = () => {
      void refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, user]);

  const markAsRead = React.useCallback(
    async (id: string) => {
      const target = notificationsRef.current.find(
        (notification) => notification.id === id,
      );

      if (!target || target.read) {
        return;
      }

      mutationEpoch.current += 1;
      // Bell preview is unread-only — remove immediately on mark-read.
      setNotifications((current) =>
        current.filter((notification) => notification.id !== id),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      if (target.href !== undefined) {
        setUnreadActionUrls((current) => {
          const index = current.findIndex((url) => url === target.href);
          if (index < 0) {
            return current;
          }
          return [...current.slice(0, index), ...current.slice(index + 1)];
        });
      }

      try {
        await markNotificationReadById(id);
      } catch (error) {
        console.error("Failed to mark notification read:", error);
        mutationEpoch.current += 1;
        void refresh();
      }
    },
    [refresh],
  );

  const markAllAsRead = React.useCallback(async () => {
    if (!notificationsRef.current.some((notification) => !notification.read)) {
      return;
    }

    mutationEpoch.current += 1;
    // Bell preview is unread-only — clear the list on mark-all-read.
    setNotifications([]);
    setUnreadCount(0);
    setUnreadActionUrls([]);

    try {
      await markAllNotificationsRead();
    } catch (error) {
      console.error("Failed to mark all notifications read:", error);
      mutationEpoch.current += 1;
      void refresh();
    }
  }, [refresh]);

  const value = React.useMemo(
    () => ({
      notifications,
      unreadCount,
      unreadActionUrls,
      isLoading,
      refresh,
      markAsRead,
      markAllAsRead,
    }),
    [
      notifications,
      unreadCount,
      unreadActionUrls,
      isLoading,
      refresh,
      markAsRead,
      markAllAsRead,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider.",
    );
  }
  return context;
}
