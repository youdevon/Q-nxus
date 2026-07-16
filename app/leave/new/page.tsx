import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeaveRequestForm } from "@/src/modules/hr/components/leave-request-form";
import { getNewLeaveRequestData } from "@/src/modules/hr/data/get-new-leave-request-data";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Request Leave",
};

export const dynamic = "force-dynamic";

export default async function NewLeaveRequestPage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.can("leave.request")) {
    notFound();
  }

  const data = await getNewLeaveRequestData();

  return <LeaveRequestForm data={data} />;
}
