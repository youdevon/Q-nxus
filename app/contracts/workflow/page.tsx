import type { Metadata } from "next";

import { ContractWorkflowSettingsForm } from "@/src/modules/hr/components/contract-workflow-settings-form";
import { getContractWorkflowSettingsPageData } from "@/src/modules/hr/data/get-contract-workflow-settings-page";

export const metadata: Metadata = {
  title: "Contract workflow",
};

export const dynamic = "force-dynamic";

export default async function ContractWorkflowSettingsPage() {
  const data = await getContractWorkflowSettingsPageData();

  return <ContractWorkflowSettingsForm data={data} />;
}
