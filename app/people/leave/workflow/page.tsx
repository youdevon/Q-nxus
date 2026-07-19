import type { Metadata } from "next";

import { LeaveWorkflowSettingsForm } from "@/src/modules/hr/components/leave-workflow-settings-form";
import { getLeaveWorkflowSettingsPageData } from "@/src/modules/hr/data/get-leave-workflow-settings-page";

export const metadata: Metadata = {
  title: "Leave workflow",
};

export const dynamic = "force-dynamic";

export default async function LeaveWorkflowSettingsPage() {
  const data = await getLeaveWorkflowSettingsPageData();

  return <LeaveWorkflowSettingsForm data={data} />;
}
