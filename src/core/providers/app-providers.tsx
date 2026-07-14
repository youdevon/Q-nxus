"use client"

import type { ReactNode } from "react"
import { ThemeProvider } from "next-themes"

import { Toaster } from "@/components/ui/sonner"
import { AppShell } from "@/src/components/layout/app-shell"
import { NotificationProvider } from "@/src/modules/notifications"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NotificationProvider>
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" richColors closeButton />
      </NotificationProvider>
    </ThemeProvider>
  )
}
