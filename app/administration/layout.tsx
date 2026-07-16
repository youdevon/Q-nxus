import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";

export default async function AdministrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  const capabilities = await getUserCapabilities();

  if (!capabilities?.can("administration.view")) {
    redirect("/");
  }

  return children;
}
