import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";

/**
 * Capability check must not `await` in the layout body — that blocks
 * `loading.tsx` for the whole segment (Next.js layout + loading caveat).
 * Run the gate in parallel so the page shell can stream immediately.
 */
async function RequireAdministrationAccess() {
  const capabilities = await getUserCapabilities();

  if (!capabilities?.can("administration.view")) {
    redirect("/");
  }

  return null;
}

export default function AdministrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <RequireAdministrationAccess />
      </Suspense>
      {children}
    </>
  );
}
