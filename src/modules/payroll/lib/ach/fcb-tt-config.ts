/**
 * First Citizens Bank Limited (Trinidad & Tobago) — ACH / salary file config.
 *
 * Local ACH operator: InfoLink Services Limited (TTIPS).
 * Upload: First Citizens Business Online → "ACH Payment with File Import".
 * Currency: TTD only. Domestic only. Do NOT apply US First Citizens / Fed ACH rules.
 *
 * Bank participant allowlist lives in FinancialInstitution (Payroll Settings →
 * ACH banks). This file holds ODFI / format defaults only — not a second bank table.
 */

/** Central Bank of Trinidad & Tobago single-entry credit threshold (exclusive). */
export const FCB_TT_MAX_ENTRY_AMOUNT_CENTS = 50_000_000; // $500,000.00 — reject ≥ this
export const FCB_TT_MIN_ENTRY_AMOUNT_CENTS = 1; // reject $0.00

/** FCB TT ODFI routing (9 digits). Trace prefix = first 8 digits. */
export const FCB_TT_ODFI_ROUTING = "010100013";
export const FCB_TT_ODFI_TRACE_PREFIX = FCB_TT_ODFI_ROUTING.slice(0, 8); // 01010001

/** Immediate Destination for FULL_NACHA File Header (10 chars: leading space + ABA). */
export const FCB_TT_IMMEDIATE_DESTINATION = " 010100013";
export const FCB_TT_DESTINATION_NAME = "FIRST CITIZENS BANK";

/** Output modes for the salary ACH file. */
export type FcbAchOutputMode = "ENTRIES_ONLY" | "FULL_NACHA";

/** Name formatting for Individual Name (positions 55–76). */
export type FcbAchNameFormat = "FIRST_TWO_SPACES_LAST";

/**
 * Static bank / file defaults. Org overrides live in AchExportSettings (DomainSetting).
 */
export const FCB_TT_ACH_DEFAULTS = {
  outputMode: "ENTRIES_ONLY" as FcbAchOutputMode,
  /**
   * When true, every credit uses transaction code 32 (savings).
   * Known-good EasyPay/FCB samples used 32 for all lines; code 22 is unproven
   * through FCB Business Online import — leave false until confirmed.
   */
  forceSavingsCode: false,
  lineEnding: "CRLF" as "CRLF" | "LF",
  trailingNewline: true,
  fileExtension: "txt",
  /** Tokens: YYYYMMDD, RUNID, BATCHID */
  fileNamePattern: "FCB_ACH_SALARY_{YYYYMMDD}.txt",
  nameFormat: "FIRST_TWO_SPACES_LAST" as FcbAchNameFormat,
  individualIdTemplate: "SALARY {YYYYMMDD}",
  secCode: "PPD",
  serviceClassCode: "220",
  originatorStatusCode: "1",
  /**
   * TODO: value assigned by FCB — required for FULL_NACHA only.
   * Leave empty until bank provides Company Identification / Immediate Origin.
   */
  companyId: "",
  immediateOrigin: "",
  companyName: "",
} as const;
