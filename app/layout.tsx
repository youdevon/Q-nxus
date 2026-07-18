import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@wrksz/themes/next";

import { appConfig } from "@/src/config/app.config";
import { AppProviders } from "@/src/core/providers/app-providers";
import { getSessionContext } from "@/src/modules/auth/data/get-session-context";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { chrome } = await getSessionContext();
  const titleBase = chrome.organizationName || chrome.displayName;

  return {
    title: {
      default: titleBase,
      template: `%s · ${titleBase}`,
    },
    description: appConfig.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { user, capabilities, chrome } = await getSessionContext();

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
            chrome={chrome}
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
  );
}
