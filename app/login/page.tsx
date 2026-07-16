import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { appConfig } from "@/src/config/app.config";
import { LoginForm } from "@/src/modules/auth/components/login-form";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";

export const metadata: Metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user?.isActive) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-svh flex-col justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.02_250)_0%,_transparent_55%),linear-gradient(to_bottom,_var(--background),_oklch(0.96_0.01_250))]"
      />

      <div className="relative z-10">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {appConfig.organizationName} · {appConfig.codename}
        </p>
      </div>
    </div>
  );
}
