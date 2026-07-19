import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/src/modules/auth/components/login-form";
import { getApplicationChrome } from "@/src/modules/admin/data/get-application-chrome";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";

export const metadata: Metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [user, chrome] = await Promise.all([
    getCurrentUser(),
    getApplicationChrome(),
  ]);

  if (user?.isActive) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-svh flex-col justify-center overflow-hidden bg-background px-4 py-16 text-foreground">
      {/* Theme-aware canvas: soft brand wash that stays behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/15 via-muted/60 to-background dark:from-primary/25 dark:via-background dark:to-background"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,_color-mix(in_oklch,var(--primary)_22%,transparent)_0%,_transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,_color-mix(in_oklch,var(--primary)_28%,transparent)_0%,_transparent_70%)]"
      />

      <div className="relative z-10">
        <Suspense fallback={null}>
          <LoginForm
            shortName={chrome.shortName}
            organizationName={chrome.organizationName}
          />
        </Suspense>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {chrome.organizationName}
          {chrome.organizationCode ? ` · ${chrome.organizationCode}` : ""}
        </p>
      </div>
    </div>
  );
}
