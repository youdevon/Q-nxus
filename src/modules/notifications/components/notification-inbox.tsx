import Link from "next/link";
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  CircleAlert,
  Info,
  MailOpen,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { formatDisplayDateTime } from "@/src/lib/format";
import {
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "@/src/modules/notifications/actions/manage-user-notifications";
import type { UserNotificationInbox } from "@/src/modules/notifications/data/get-user-notifications";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function severityIcon(severity: string) {
  if (severity === "SUCCESS") {
    return <CheckCircle2 className="size-5" />;
  }

  if (severity === "WARNING") {
    return <TriangleAlert className="size-5" />;
  }

  if (severity === "ERROR") {
    return <AlertCircle className="size-5" />;
  }

  if (severity === "CRITICAL") {
    return <CircleAlert className="size-5" />;
  }

  return <Info className="size-5" />;
}

function formatDate(value: string): string {
  return formatDisplayDateTime(value);
}

export function NotificationInbox({ data }: { data: UserNotificationInbox }) {
  const unread = data.notifications.filter(
    (notification) => notification.status === "UNREAD",
  );

  const read = data.notifications.filter(
    (notification) => notification.status !== "UNREAD",
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Notifications"
        description={`Alerts and actions for ${data.user.name}`}
        actions={
          data.unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="outline">
                <CheckCheck />
                Mark all as read
              </Button>
            </form>
          ) : null
        }
      />

      <section className="grid gap-8 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Unread</p>
          <p className="mt-1 text-2xl font-semibold">{data.unreadCount}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Total notifications</p>
          <p className="mt-1 text-2xl font-semibold">
            {data.notifications.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">User</p>
          <p className="mt-1 text-sm font-medium">{data.user.email}</p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Requires attention
          </h2>
        </div>

        {unread.length === 0 ? (
          <div className="py-12 text-center">
            <BellOff className="mx-auto size-7 text-muted-foreground" />

            <p className="mt-3 text-sm font-medium">No unread notifications</p>

            <p className="mt-1 text-xs text-muted-foreground">
              New alerts and approval requests will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {unread.map((notification) => (
              <article
                key={notification.recipientId}
                className="grid gap-5 py-6 md:grid-cols-[2.5rem_1fr_auto]"
              >
                <div className="flex size-10 items-center justify-center border border-border">
                  {severityIcon(notification.severity)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{notification.title}</p>

                    <Badge variant="default">Unread</Badge>

                    <Badge variant="outline">
                      {label(notification.moduleKey)}
                    </Badge>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {notification.message}
                  </p>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>

                <form action={markNotificationRead}>
                  <input
                    type="hidden"
                    name="recipientId"
                    value={notification.recipientId}
                  />

                  <input
                    type="hidden"
                    name="actionUrl"
                    value={notification.actionUrl ?? ""}
                  />

                  <Button type="submit">
                    <MailOpen />
                    {notification.actionUrl ? "Open" : "Mark read"}
                  </Button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CheckCheck className="size-4 text-muted-foreground" />

          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Earlier notifications
          </h2>
        </div>

        {read.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No earlier notifications.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {read.map((notification) => (
              <article
                key={notification.recipientId}
                className="grid gap-5 py-5 md:grid-cols-[2.5rem_1fr_auto]"
              >
                <div className="flex size-10 items-center justify-center border border-border text-muted-foreground">
                  {severityIcon(notification.severity)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {notification.actionUrl ? (
                      <Link
                        href={notification.actionUrl}
                        className="font-medium hover:underline"
                      >
                        {notification.title}
                      </Link>
                    ) : (
                      <p className="font-medium">{notification.title}</p>
                    )}

                    <Badge variant="outline">
                      {label(notification.moduleKey)}
                    </Badge>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {notification.message}
                  </p>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>

                <form action={markNotificationUnread}>
                  <input
                    type="hidden"
                    name="recipientId"
                    value={notification.recipientId}
                  />

                  <Button type="submit" variant="outline">
                    <Bell />
                    Mark unread
                  </Button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
