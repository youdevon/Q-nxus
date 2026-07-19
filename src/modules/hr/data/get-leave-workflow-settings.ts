import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LEAVE_WORKFLOW_SETTINGS,
  LEAVE_WORKFLOW_SETTING_CODE,
  parseLeaveWorkflowSettings,
  type LeaveWorkflowSettings,
} from "@/src/modules/hr/lib/leave-workflow-settings";

export async function getLeaveWorkflowSettings(
  organizationId: string,
): Promise<LeaveWorkflowSettings> {
  const setting = await prisma.domainSetting.findUnique({
    where: {
      organizationId_settingCode: {
        organizationId,
        settingCode: LEAVE_WORKFLOW_SETTING_CODE,
      },
    },
    select: {
      value: true,
      status: true,
    },
  });

  if (!setting || setting.status !== "ACTIVE") {
    return { ...DEFAULT_LEAVE_WORKFLOW_SETTINGS };
  }

  return parseLeaveWorkflowSettings(setting.value);
}
