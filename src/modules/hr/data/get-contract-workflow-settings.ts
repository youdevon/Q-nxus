import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CONTRACT_WORKFLOW_SETTINGS,
  CONTRACT_WORKFLOW_SETTING_CODE,
  parseContractWorkflowSettings,
  type ContractWorkflowSettings,
} from "@/src/modules/hr/lib/contract-workflow-settings";

export async function getContractWorkflowSettings(
  organizationId: string,
): Promise<ContractWorkflowSettings> {
  const setting = await prisma.domainSetting.findUnique({
    where: {
      organizationId_settingCode: {
        organizationId,
        settingCode: CONTRACT_WORKFLOW_SETTING_CODE,
      },
    },
    select: {
      value: true,
      status: true,
    },
  });

  if (!setting || setting.status !== "ACTIVE") {
    return { ...DEFAULT_CONTRACT_WORKFLOW_SETTINGS };
  }

  return parseContractWorkflowSettings(setting.value);
}
