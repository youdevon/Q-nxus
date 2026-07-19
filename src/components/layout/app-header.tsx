"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  resolveBreadcrumb,
  shouldShowAppBreadcrumbs,
  simplifyAppBreadcrumbs,
} from "@/src/components/layout/resolve-breadcrumb";
import { ThemeSwitcher } from "@/src/components/layout/theme-switcher";
import { UI_SURFACE } from "@/src/config/ui-typography";
import { ChangePasswordDialog } from "@/src/modules/auth/components/change-password-dialog";
import { logout } from "@/src/modules/auth/actions/login";
import { useAuth } from "@/src/modules/auth/context/auth-provider";
import { NotificationBell } from "@/src/modules/notifications";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function AppHeader() {
  const pathname = usePathname();
  const allCrumbs = resolveBreadcrumb(pathname);
  const showBreadcrumbs = shouldShowAppBreadcrumbs(allCrumbs);
  const crumbs = showBreadcrumbs ? simplifyAppBreadcrumbs(allCrumbs) : [];
  const { user } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const displayName = user
    ? `${user.firstName} ${user.lastName}`
    : "Signed out";
  const email = user?.email ?? "";

  return (
    <header
      className={`sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 px-4 ${UI_SURFACE.appHeader}`}
    >
      <SidebarTrigger className="-ml-1" />

      {showBreadcrumbs ? (
        <>
          <Separator
            orientation="vertical"
            className="mr-1 hidden h-4 sm:block"
          />
          <Breadcrumb className="hidden min-w-0 sm:block">
            <BreadcrumbList>
              {crumbs.map((crumb, index) => (
                <div key={`${crumb.href}-${index}`} className="contents">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {crumb.current ? (
                      <BreadcrumbPage className="truncate">
                        {crumb.label}
                      </BreadcrumbPage>
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
        </>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <NotificationBell />
        <ThemeSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full px-1.5"
                aria-label="Account menu"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback>
                {user ? initials(user.firstName, user.lastName) : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              {displayName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{displayName}</span>
                  {email && (
                    <span className="text-xs text-muted-foreground">
                      {email}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              Change password
            </DropdownMenuItem>
            <form action={logout}>
              <DropdownMenuItem
                nativeButton
                render={<button type="submit" className="w-full" />}
              >
                Sign out
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>

        <ChangePasswordDialog
          open={changePasswordOpen}
          onOpenChange={setChangePasswordOpen}
        />
      </div>
    </header>
  );
}
