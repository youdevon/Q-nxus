import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LeaveRequestForm } from "@/src/modules/hr/components/leave-request-form";
import { getSelfNewLeaveRequestData } from "@/src/modules/hr/data/get-new-leave-request-data";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { requiresEmployeeFile } from "@/src/modules/hr/lib/workforce-category";

export const metadata: Metadata = {
  title: "Request Leave",
};

export const dynamic = "force-dynamic";

export default async function NewSelfLeaveRequestPage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.can("leave.request")) {
    notFound();
  }

  if (!capabilities.employeeId) {
    redirect("/me");
  }

  const user = await getCurrentUser();
  if (!requiresEmployeeFile(user?.employee?.workforceCategory)) {
    redirect("/me");
  }

  const data = await getSelfNewLeaveRequestData();

  if (!data) {
    notFound();
  }

  return <LeaveRequestForm data={data} />;
}
