import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "My Contracts",
};

export const dynamic = "force-dynamic";

export default async function MyContractsPage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    redirect("/");
  }

  redirect(`/people/employees/${capabilities.employeeId}/contracts`);
}
