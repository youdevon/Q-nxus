import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NotificationInbox } from "@/src/modules/notifications/components/notification-inbox";
import { getUserNotifications } from "@/src/modules/notifications/data/get-user-notifications";

export const metadata: Metadata = {
  title: "Notifications",
};

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams: Promise<{ module?: string; unread?: string }>;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const params = await searchParams;
  const moduleKey =
    params.module?.trim().toLowerCase() === "payroll" ? "payroll" : undefined;
  const unreadOnly = params.unread === "1" || params.unread === "true";

  const data = await getUserNotifications(250, {
    moduleKey,
    unreadOnly,
  });

  if (!data) {
    notFound();
  }

  const activeFilter = unreadOnly
    ? "unread"
    : moduleKey === "payroll"
      ? "payroll"
      : "all";

  return <NotificationInbox data={data} activeFilter={activeFilter} />;
}
