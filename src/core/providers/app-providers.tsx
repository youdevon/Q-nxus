"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Toaster } from "@/components/ui/sonner";
import { AuditClientMetadataBinder } from "@/src/components/audit/audit-client-metadata-binder";
import { AppShell } from "@/src/components/layout/app-shell";
import { ApplicationChromeProvider } from "@/src/core/providers/application-chrome-provider";
import type { ApplicationChrome } from "@/src/modules/admin/data/get-application-chrome";
import type { CurrentUser } from "@/src/modules/auth/data/get-current-user";
import {
  AuthProvider,
  type AuthCapabilities,
} from "@/src/modules/auth/context/auth-provider";
import { NotificationProvider } from "@/src/modules/notifications";

function isPrintDocumentRoute(pathname: string) {
  return (
    pathname === "/me/payslip/print" ||
    pathname === "/payroll/print/ready" ||
    /^\/payroll\/employees\/[^/]+\/payslip\/print\/?$/.test(pathname) ||
    /^\/payroll\/employees\/[^/]+\/tax-year\/print\/?$/.test(pathname) ||
    /^\/people\/employees\/[^/]+\/payroll\/payslip\/print\/?$/.test(pathname) ||
    /^\/payroll\/runs\/[^/]+\/payslips\/[^/]+\/print\/?$/.test(pathname) ||
    /^\/payroll\/runs\/[^/]+\/print\/?$/.test(pathname)
  );
}

function isShellLessRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/account/change-password" ||
    pathname.startsWith("/account/change-password/") ||
    isPrintDocumentRoute(pathname)
  );
}

export function AppProviders({
  children,
  user,
  capabilities,
  chrome,
}: {
  children: ReactNode;
  user: CurrentUser | null;
  capabilities: AuthCapabilities | null;
  chrome: ApplicationChrome;
}) {
  const pathname = usePathname();
  const shellLess = isShellLessRoute(pathname);

  return (
    <AuthProvider user={user} capabilities={capabilities}>
      <ApplicationChromeProvider chrome={chrome}>
        <NotificationProvider>
          <AuditClientMetadataBinder />
          {shellLess ? children : <AppShell>{children}</AppShell>}
          <Toaster position="top-right" richColors closeButton />
        </NotificationProvider>
      </ApplicationChromeProvider>
    </AuthProvider>
  );
}
