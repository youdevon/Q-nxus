import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { NotificationInbox } from "@/src/modules/notifications/components/notification-inbox"
import { getUserNotifications } from "@/src/modules/notifications/data/get-user-notifications"

export const metadata: Metadata = {
  title: "Notifications",
}

export const dynamic = "force-dynamic"

export default async function NotificationsPage() {
  const data = await getUserNotifications()

  if (!data) {
    notFound()
  }

  return <NotificationInbox data={data} />
}
