import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@wrksz/themes/next"

import { appConfig } from "@/src/config/app.config"
import { AppProviders } from "@/src/core/providers/app-providers"
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user"
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: appConfig.displayName,
    template: `%s · ${appConfig.displayName}`,
  },
  description: appConfig.description,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const user = await getCurrentUser()
  const capabilities = user
    ? await getUserCapabilities(user.id)
    : null

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppProviders
            user={user}
            capabilities={
              capabilities
                ? {
                    permissions: capabilities.permissions,
                    roleCodes: capabilities.roleCodes,
                    employeeId: capabilities.employeeId,
                    isSystemAdmin: capabilities.isSystemAdmin,
                    isHrAdmin: capabilities.isHrAdmin,
                    isEmployeeOnly: capabilities.isEmployeeOnly,
                  }
                : null
            }
          >
            {children}
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  )
}
