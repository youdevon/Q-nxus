import type { Metadata } from "next";

import { LeaveTypeForm } from "@/src/modules/hr/components/leave-type-form";
import { requireLeaveManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "New Leave Type",
};

export const dynamic = "force-dynamic";

export default async function NewLeaveTypePage() {
  await requireLeaveManageAccess();

  return <LeaveTypeForm />;
}
