/**
 * ACH export settings — never invent bank rules for unknowns.
 */

import {
  FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
  FIRST_CITIZENS_ODFI_ROUTING,
  digitsOnly,
  type FcbAchExportFormatId,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";

export type AchTransactionCodePolicy =
  | "USE_ACCOUNT_TYPE"
  | "FORCE_LEGACY_CODE";

export type AchTraceStrategy = "CONFIGURED_PREFIX_SEQUENCE";

export type AchExportSettings = {
  enabled: boolean;
  exportFormat: FcbAchExportFormatId;
  transactionCodePolicy: AchTransactionCodePolicy;
  /** Used when transactionCodePolicy === FORCE_LEGACY_CODE. */
  legacyTransactionCode: "22" | "32";
  lineEnding: "CRLF";
  receiverNameUppercase: true;
  traceStrategy: AchTraceStrategy;
  /** Full 9-digit ODFI routing; first 8 digits become the trace prefix. */
  odfiRoutingNumber: string;
  salaryReferenceTemplate: "SALARY {YYYYMMDD}";
  entryDescription: string;
  allowExportWithWarnings: boolean;
  discretionaryData: string;
};

export const DEFAULT_ACH_EXPORT_SETTINGS: AchExportSettings = {
  enabled: false,
  exportFormat: FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
  transactionCodePolicy: "USE_ACCOUNT_TYPE",
  legacyTransactionCode: "32",
  lineEnding: "CRLF",
  receiverNameUppercase: true,
  traceStrategy: "CONFIGURED_PREFIX_SEQUENCE",
  odfiRoutingNumber: FIRST_CITIZENS_ODFI_ROUTING,
  salaryReferenceTemplate: "SALARY {YYYYMMDD}",
  entryDescription: "Salary",
  allowExportWithWarnings: false,
  discretionaryData: "  ",
};

export const ACH_SETTINGS_DOMAIN_CODE = "payroll.ach.export_settings";
export const ACH_TRACE_SEQUENCE_DOMAIN_CODE = "payroll.ach.trace_sequence";

export function parseAchExportSettings(value: unknown): AchExportSettings {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return { ...DEFAULT_ACH_EXPORT_SETTINGS };
  }
  const record = value as Record<string, unknown>;
  const legacyCode =
    record.legacyTransactionCode === "22" || record.legacyTransactionCode === "32"
      ? record.legacyTransactionCode
      : DEFAULT_ACH_EXPORT_SETTINGS.legacyTransactionCode;

  return {
    ...DEFAULT_ACH_EXPORT_SETTINGS,
    enabled: record.enabled === true,
    exportFormat:
      record.exportFormat === FCB_TT_LEGACY_NACHA_NO_HEADER_V1
        ? FCB_TT_LEGACY_NACHA_NO_HEADER_V1
        : DEFAULT_ACH_EXPORT_SETTINGS.exportFormat,
    transactionCodePolicy:
      record.transactionCodePolicy === "FORCE_LEGACY_CODE"
        ? "FORCE_LEGACY_CODE"
        : "USE_ACCOUNT_TYPE",
    legacyTransactionCode: legacyCode,
    odfiRoutingNumber:
      typeof record.odfiRoutingNumber === "string" &&
      digitsOnly(record.odfiRoutingNumber).length === 9
        ? digitsOnly(record.odfiRoutingNumber)
        : DEFAULT_ACH_EXPORT_SETTINGS.odfiRoutingNumber,
    entryDescription:
      typeof record.entryDescription === "string" &&
      record.entryDescription.trim()
        ? record.entryDescription.trim()
        : DEFAULT_ACH_EXPORT_SETTINGS.entryDescription,
    allowExportWithWarnings: record.allowExportWithWarnings === true,
    discretionaryData:
      typeof record.discretionaryData === "string"
        ? record.discretionaryData.padEnd(2, " ").slice(0, 2)
        : DEFAULT_ACH_EXPORT_SETTINGS.discretionaryData,
  };
}

export function isLegacyTransactionOverrideActive(
  settings: AchExportSettings,
): boolean {
  return settings.transactionCodePolicy === "FORCE_LEGACY_CODE";
}
