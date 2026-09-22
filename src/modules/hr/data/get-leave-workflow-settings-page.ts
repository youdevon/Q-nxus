import { getApplicationChrome } from "@/src/modules/admin/data/get-application-chrome";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getLeaveForfeitureSettings } from "@/src/modules/hr/data/get-leave-forfeiture-settings";
import { getLeaveWorkflowSettings } from "@/src/modules/hr/data/get-leave-workflow-settings";
import { getWorkflowPositionOptions } from "@/src/modules/hr/data/get-workflow-position-options";
import { requireLeaveManageAccess } from "@/src/modules/hr/data/require-people-access";

export async function getLeaveWorkflowSettingsPageData() {
  await requireLeaveManageAccess();

  const [user, chrome] = await Promise.all([
    getCurrentUser(),
    getApplicationChrome(),
  ]);

  const organizationId = user?.organizationId;
  if (!organizationId) {
    throw new Error("No organization is configured for the current user.");
  }

  const [settings, forfeitureSettings, positions] = await Promise.all([
    getLeaveWorkflowSettings(organizationId),
    getLeaveForfeitureSettings(organizationId),
    getWorkflowPositionOptions(organizationId),
  ]);

  return {
    organizationName: chrome.organizationName,
    settings,
    forfeitureSettings,
    positions,
  };
}

export type LeaveWorkflowSettingsPageData = Awaited<
  ReturnType<typeof getLeaveWorkflowSettingsPageData>
>;
