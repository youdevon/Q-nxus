import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeaveTypeForm } from "@/src/modules/hr/components/leave-type-form";
import { getLeaveTypeDetail } from "@/src/modules/hr/data/get-leave-types";
import { requireLeaveManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Edit Leave Type",
};

export const dynamic = "force-dynamic";

export default async function EditLeaveTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireLeaveManageAccess();

  const { id } = await params;
  const leaveType = await getLeaveTypeDetail(id);

  if (!leaveType) {
    notFound();
  }

  return <LeaveTypeForm leaveType={leaveType} />;
}
