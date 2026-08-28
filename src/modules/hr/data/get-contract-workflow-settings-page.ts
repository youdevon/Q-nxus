import { getApplicationChrome } from "@/src/modules/admin/data/get-application-chrome";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getContractWorkflowSettings } from "@/src/modules/hr/data/get-contract-workflow-settings";
import { getWorkflowPositionOptions } from "@/src/modules/hr/data/get-workflow-position-options";
import { requireContractManageAccess } from "@/src/modules/hr/data/require-people-access";

export async function getContractWorkflowSettingsPageData() {
  await requireContractManageAccess();

  const [user, chrome] = await Promise.all([
    getCurrentUser(),
    getApplicationChrome(),
  ]);

  const organizationId = user?.organizationId;
  if (!organizationId) {
    throw new Error("No organization is configured for the current user.");
  }

  const [settings, positions] = await Promise.all([
    getContractWorkflowSettings(organizationId),
    getWorkflowPositionOptions(organizationId),
  ]);

  return {
    organizationName: chrome.organizationName,
    settings,
    positions,
  };
}

export type ContractWorkflowSettingsPageData = Awaited<
  ReturnType<typeof getContractWorkflowSettingsPageData>
>;
