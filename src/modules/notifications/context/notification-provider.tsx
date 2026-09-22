"use client";

import * as React from "react";

import {
  markAllNotificationsRead,
  markNotificationReadById,
} from "@/src/modules/notifications/actions/manage-user-notifications";
import type { NotificationBellState } from "@/src/modules/notifications/data/get-notification-bell-state";
import { useAuth } from "@/src/modules/auth/context/auth-provider";
import type { AppNotification } from "@/src/types/notifications";

const POLL_INTERVAL_MS = 60_000;
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

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  return error instanceof Error && error.name === "AbortError";
}

/** A signed-out bell is expected once a session expires, so it is not an error. */
type BellFetchResult =
  | { kind: "state"; state: NotificationBellState }
  | { kind: "signedOut" };

async function fetchBellState(): Promise<BellFetchResult> {
  const response = await fetch(BELL_ENDPOINT, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    // Without this, an auth redirect to /login is followed transparently and
    // arrives as a 200 HTML page that reads as corrupt JSON.
    redirect: "manual",
  });

  const wasRedirected =
    response.type === "opaqueredirect" ||
    response.redirected ||
    (response.status >= 300 && response.status < 400);

  if (
    wasRedirected ||
    response.status === 401 ||
    response.status === 403
  ) {
    return { kind: "signedOut" };
  }

  if (!response.ok) {
    throw new Error(`Notification bell request failed (${response.status})`);
  }

  // Prefer text → JSON.parse so empty bodies and HTML error pages produce a
  // clear error. Safari surfaces bad JSON as
  // "The string did not match the expected pattern."
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Notification bell response was empty");
  }

  try {
    return { kind: "state", state: JSON.parse(text) as NotificationBellState };
  } catch {
    throw new Error(
      `Notification bell response was not JSON (${text.slice(0, 80)})`,
    );
  }
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
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
  /** Set when the server reports no session, to stop the poll from retrying. */
  const isSignedOut = React.useRef(false);

  React.useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const clearBell = React.useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setUnreadActionUrls([]);
    setIsLoading(false);
  }, []);

  const refresh = React.useCallback(async () => {
    if (!user) {
      clearBell();
      hasLoadedOnce.current = false;
      return;
    }

    if (isSignedOut.current) {
      return;
    }

    // Stale responses are dropped via requestId — avoid AbortController so
    // mid-body cancels do not surface as Safari JSON SyntaxErrors.
    const requestId = ++refreshRequestId.current;
    const epochAtStart = mutationEpoch.current;

    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    }

    try {
      const result = await fetchBellState();

      if (requestId !== refreshRequestId.current) {
        return;
      }

      if (result.kind === "signedOut") {
        isSignedOut.current = true;
        clearBell();
        return;
      }

      // A mark-read happened while this request was in flight — keep optimistic UI.
      if (epochAtStart !== mutationEpoch.current) {
        return;
      }

      const { state } = result;
      setNotifications(state.notifications);
      setUnreadCount(state.unreadCount);
      setUnreadActionUrls(
        Array.isArray(state.unreadActionUrls) ? state.unreadActionUrls : [],
      );
      hasLoadedOnce.current = true;
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error("Failed to refresh notifications:", error);
    } finally {
      if (requestId === refreshRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [clearBell, user]);

  React.useEffect(() => {
    // A rendered document means the session passed the proxy, so allow polling
    // again after a previous refresh was rejected as signed out.
    isSignedOut.current = false;

    // Mount / auth change only — do not refetch on every client navigation.
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refresh]);

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
      // Keep the row as history; only flip unread → read.
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, read: true }
            : notification,
        ),
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
    setNotifications((current) =>
      current.map((notification) =>
        notification.read ? notification : { ...notification, read: true },
      ),
    );
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
