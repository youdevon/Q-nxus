"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SearchIcon } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeSwitcher } from "@/src/components/layout/theme-switcher"
import { navigationConfig } from "@/src/config/navigation.config"
import { NotificationBell } from "@/src/modules/notifications"

function resolveBreadcrumb(pathname: string) {
  if (pathname === "/") {
    return [{ label: "Dashboard", href: "/", current: true }]
  }

  const match = navigationConfig
    .flatMap((section) => section.items)
    .find(
      (item) => item.href !== "/" && pathname.startsWith(item.href)
    )

  return [
    { label: "Dashboard", href: "/", current: false },
    {
      label: match?.title ?? "Page",
      href: match?.href ?? pathname,
      current: true,
    },
  ]
}

export function AppHeader() {
  const pathname = usePathname()
  const crumbs = resolveBreadcrumb(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur supports-backdrop-filter:bg-background/75">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />

      <Breadcrumb className="hidden min-w-0 sm:block">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <div key={crumb.href} className="contents">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.current ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative hidden md:block">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search…"
            className="h-8 w-56 pl-8 lg:w-72"
            aria-label="Search"
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label="Search"
        >
          <SearchIcon />
        </Button>

        <NotificationBell />
        <ThemeSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Account menu"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback>AM</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Alex Morgan</span>
                <span className="text-xs text-muted-foreground">
                  alex.morgan@example.com
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
