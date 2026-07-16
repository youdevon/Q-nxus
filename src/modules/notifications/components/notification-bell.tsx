"use client";

import Link from "next/link";
import { BellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationItem } from "@/src/modules/notifications/components/notification-item";
import { useNotifications } from "@/src/modules/notifications/context/notification-provider";

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isLoading,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          void refresh();
        }
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
          />
        }
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 sm:w-96">
        <DropdownMenuGroup className="flex items-center justify-between gap-2 px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <DropdownMenuItem
              closeOnClick={false}
              className="h-auto cursor-pointer rounded-md p-0 text-xs text-muted-foreground focus:bg-transparent focus:text-foreground data-highlighted:bg-transparent"
              onClick={() => {
                void markAllAsRead();
              }}
            >
              Mark all as read
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {isLoading ? "Loading notifications…" : "You’re all caught up"}
            </p>
          ) : (
            notifications.map((notification) => {
              const href = notification.href;

              return (
                <DropdownMenuItem
                  key={notification.id}
                  className="cursor-pointer rounded-none p-0 focus:bg-muted/70 data-highlighted:bg-muted/70"
                  closeOnClick={Boolean(href)}
                  nativeButton={!href}
                  render={
                    href ? (
                      <Link href={href} className="block w-full outline-none" />
                    ) : undefined
                  }
                  onClick={() => {
                    void markAsRead(notification.id);
                  }}
                >
                  <NotificationItem
                    notification={notification}
                    interactive={false}
                  />
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem
          className="cursor-pointer justify-center rounded-none px-3 py-2.5 text-xs font-medium text-muted-foreground focus:bg-transparent focus:text-foreground data-highlighted:bg-transparent"
          nativeButton={false}
          render={
            <Link
              href="/notifications"
              className="block w-full text-center outline-none"
            />
          }
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
