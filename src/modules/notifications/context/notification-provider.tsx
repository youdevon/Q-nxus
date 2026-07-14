"use client"

import * as React from "react"

import { mockNotifications } from "@/src/modules/notifications/data/mock-notifications"
import type { AppNotification } from "@/src/types/notifications"

type NotificationContextValue = {
  notifications: AppNotification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

const NotificationContext =
  React.createContext<NotificationContextValue | null>(null)

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [notifications, setNotifications] =
    React.useState<AppNotification[]>(mockNotifications)

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  const markAsRead = React.useCallback((id: string) => {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllAsRead = React.useCallback(() => {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })))
  }, [])

  const value = React.useMemo(
    () => ({ notifications, unreadCount, markAsRead, markAllAsRead }),
    [notifications, unreadCount, markAsRead, markAllAsRead]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = React.useContext(NotificationContext)
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider."
    )
  }
  return context
}
