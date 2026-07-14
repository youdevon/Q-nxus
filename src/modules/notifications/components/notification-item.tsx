"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  formatModuleSourceLabel,
  formatRelativeTime,
} from "@/src/lib/format"
import {
  severityAccentClass,
  severityIconMap,
} from "@/src/modules/notifications/lib/severity-styles"
import type { AppNotification } from "@/src/types/notifications"

type NotificationItemProps = {
  notification: AppNotification
  onSelect?: (notification: AppNotification) => void
}

export function NotificationItem({
  notification,
  onSelect,
}: NotificationItemProps) {
  const Icon = severityIconMap[notification.severity]
  const content = (
    <div
      className={cn(
        "flex gap-3 px-3 py-2.5 transition-colors",
        !notification.read && "bg-sky-500/6",
        notification.href && "hover:bg-muted/70"
      )}
    >
      <div
        className={cn(
          "mt-0.5 shrink-0",
          severityAccentClass[notification.severity]
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 text-sm leading-snug",
              notification.read ? "font-normal" : "font-semibold"
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span
              aria-label="Unread"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-500"
            />
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {notification.message}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-5 rounded-md font-normal">
            {formatModuleSourceLabel(notification.moduleSource)}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(notification.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )

  if (notification.href) {
    return (
      <Link
        href={notification.href}
        className="block outline-none focus-visible:bg-muted/70"
        onClick={() => onSelect?.(notification)}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className="block w-full text-left outline-none focus-visible:bg-muted/70"
      onClick={() => onSelect?.(notification)}
    >
      {content}
    </button>
  )
}
