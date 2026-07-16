"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { Toaster } from "@/components/ui/sonner"
import { AppShell } from "@/src/components/layout/app-shell"
import type { CurrentUser } from "@/src/modules/auth/data/get-current-user"
import {
  AuthProvider,
  type AuthCapabilities,
} from "@/src/modules/auth/context/auth-provider"
import { NotificationProvider } from "@/src/modules/notifications"

function isShellLessRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/account/change-password" ||
    pathname.startsWith("/account/change-password/")
  )
}

export function AppProviders({
  children,
  user,
  capabilities,
}: {
  children: ReactNode
  user: CurrentUser | null
  capabilities: AuthCapabilities | null
}) {
  const pathname = usePathname()
  const shellLess = isShellLessRoute(pathname)

  return (
    <AuthProvider user={user} capabilities={capabilities}>
      <NotificationProvider>
        {shellLess ? children : <AppShell>{children}</AppShell>}
        <Toaster position="top-right" richColors closeButton />
      </NotificationProvider>
    </AuthProvider>
  )
}
