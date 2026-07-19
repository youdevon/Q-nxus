import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LEAVE_FORFEITURE_SETTINGS,
  LEAVE_FORFEITURE_SETTING_CODE,
  parseLeaveForfeitureSettings,
  type LeaveForfeitureSettings,
} from "@/src/modules/hr/lib/leave-forfeiture-settings";

export async function getLeaveForfeitureSettings(
  organizationId: string,
): Promise<LeaveForfeitureSettings> {
  const setting = await prisma.domainSetting.findFirst({
    where: {
      organizationId,
      settingCode: LEAVE_FORFEITURE_SETTING_CODE,
    },
    select: { value: true },
  });

  if (!setting) {
    return { ...DEFAULT_LEAVE_FORFEITURE_SETTINGS };
  }

  return parseLeaveForfeitureSettings(setting.value);
}
