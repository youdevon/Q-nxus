import { prisma } from "@/lib/prisma";
import { ConfigurationStatus, SettingDataType } from "@/generated/prisma/enums";
import {
  ACH_SETTINGS_DOMAIN_CODE,
  DEFAULT_ACH_EXPORT_SETTINGS,
  parseAchExportSettings,
  type AchExportSettings,
} from "@/src/modules/payroll/lib/ach/ach-settings";
import { getNextAchTraceSequencePreview } from "@/src/modules/payroll/lib/ach/ach-trace-generator";
import { isPayrollBankingFeatureEnabled, PAYROLL_BANKING_FEATURE_FLAGS } from "@/src/modules/payroll/lib/payroll-banking-flags";

export async function loadAchExportSettings(
  organizationId: string,
): Promise<AchExportSettings> {
  const [enabled, row] = await Promise.all([
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED,
    ),
    prisma.domainSetting.findUnique({
      where: {
        organizationId_settingCode: {
          organizationId,
          settingCode: ACH_SETTINGS_DOMAIN_CODE,
        },
      },
      select: { value: true },
    }),
  ]);

  const parsed = parseAchExportSettings(row?.value);
  return { ...parsed, enabled };
}

export async function saveAchExportSettings(input: {
  organizationId: string;
  settings: AchExportSettings;
}): Promise<AchExportSettings> {
  const normalized = parseAchExportSettings(input.settings);
  await prisma.domainSetting.upsert({
    where: {
      organizationId_settingCode: {
        organizationId: input.organizationId,
        settingCode: ACH_SETTINGS_DOMAIN_CODE,
      },
    },
    update: {
      value: normalized,
      version: { increment: 1 },
      status: ConfigurationStatus.ACTIVE,
      name: "ACH export settings",
    },
    create: {
      organizationId: input.organizationId,
      settingCode: ACH_SETTINGS_DOMAIN_CODE,
      moduleKey: "payroll",
      name: "ACH export settings",
      description:
        "First Citizens TT legacy NACHA no-header export configuration (transaction-code policy, ODFI, warnings).",
      dataType: SettingDataType.JSON,
      value: normalized,
      status: ConfigurationStatus.ACTIVE,
    },
  });
  return {
    ...normalized,
    enabled: await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED,
    ),
  };
}

export async function getAchSettingsPageData(organizationId: string): Promise<{
  settings: AchExportSettings;
  nextTraceSequence: number;
  defaults: AchExportSettings;
}> {
  const settings = await loadAchExportSettings(organizationId);
  const nextTraceSequence =
    await getNextAchTraceSequencePreview(organizationId);
  return {
    settings,
    nextTraceSequence,
    defaults: DEFAULT_ACH_EXPORT_SETTINGS,
  };
}
