/**
 * FCB Trinidad & Tobago — Legacy NACHA Entry Detail (no file/batch headers).
 * Format id is explicit so Default Transactions can be added later without rewrite.
 *
 * ## Fixed-width layout (ACH docs use 1-based positions; JS uses 0-based slices)
 *
 * | ACH pos (1-based) | Length | Field |
 * | ----------------- | -----: | ----- |
 * | 1                 |      1 | Record Type Code |
 * | 2–3               |      2 | Transaction Code |
 * | 4–11              |      8 | Receiving DFI ID |
 * | 12                |      1 | Check Digit |
 * | 13–29             |     17 | DFI Account Number (string; preserve leading zeros) |
 * | 30–39             |     10 | Amount (cents, zero-padded) |
 * | 40–54             |     15 | Individual Identification (`SALARY YYYYMMDD`) — **payment date lives here** |
 * | 55–76             |     22 | Individual / Receiver Name |
 * | 77–78             |      2 | Discretionary Data |
 * | 79                |      1 | Addenda Record Indicator |
 * | 80–94             |     15 | ACH Trace Number — **opaque 15-digit string; NEVER a payroll period** |
 *
 * Digits that look like `202608` inside a trace (e.g. `023997975202608`) are
 * coincidental. Do not split the trace into employee-ref + YYYYMM.
 */

export const FCB_TT_LEGACY_NACHA_NO_HEADER_V1 =
  "FCB_TT_LEGACY_NACHA_NO_HEADER_V1" as const;

export const FCB_TT_DEFAULT_TRANSACTIONS_V1 =
  "FCB_TT_DEFAULT_TRANSACTIONS_V1" as const;

export type FcbAchExportFormatId =
  | typeof FCB_TT_LEGACY_NACHA_NO_HEADER_V1
  | typeof FCB_TT_DEFAULT_TRANSACTIONS_V1;

export const FCB_LEGACY_RECORD_LENGTH = 94;
export const FCB_LEGACY_LINE_ENDING = "\r\n" as const;

/** First Citizens ODFI routing (TT ACH participant list). */
export const FIRST_CITIZENS_ODFI_ROUTING = "010100013";

export const FCB_LEGACY_FIELD_WIDTHS = {
  recordType: 1,
  transactionCode: 2,
  receivingDfiId: 8,
  checkDigit: 1,
  accountNumber: 17,
  amountCents: 10,
  individualId: 15,
  receiverName: 22,
  discretionaryData: 2,
  addendaIndicator: 1,
  traceNumber: 15,
} as const;

/**
 * Zero-based half-open slices matching ACH 1-based positions above.
 * Example: ACH positions 80–94 → slice(79, 94).
 */
export const FCB_LEGACY_FIELD_SLICES = {
  recordType: [0, 1] as const,
  transactionCode: [1, 3] as const,
  receivingDfiId: [3, 11] as const,
  checkDigit: [11, 12] as const,
  /** ACH 4–12 = DFI id + check digit (full 9-digit ABA). */
  routingNumber: [3, 12] as const,
  accountNumber: [12, 29] as const,
  amountCents: [29, 39] as const,
  /** Payment date is encoded here as `SALARY YYYYMMDD` — not in the trace. */
  individualIdentification: [39, 54] as const,
  receiverName: [54, 76] as const,
  discretionaryData: [76, 78] as const,
  addendaIndicator: [78, 79] as const,
  /**
   * Opaque ACH Trace Number (15 digits). Do not parse as period/date/employee.
   */
  achTraceNumber: [79, 94] as const,
} as const;

/** Digits only — ACH account / routing / trace fields (preserve as string). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Left-justify and space-pad / truncate to fixed width. */
export function padRightFixed(value: string, width: number): string {
  return value.slice(0, width).padEnd(width, " ");
}

/** Zero-pad on the left / truncate from the left to fixed width. */
export function padLeftFixed(value: string, width: number): string {
  const digits = digitsOnly(value);
  if (digits.length >= width) {
    return digits.slice(-width);
  }
  return digits.padStart(width, "0");
}

/**
 * Payment / effective date as YYYYMMDD for Individual Identification + filename.
 * Never derived from the ACH Trace Number.
 */
export function formatAchPaymentDateYyyymmdd(
  value: Date | string,
): string {
  const iso =
    typeof value === "string"
      ? value.slice(0, 10)
      : value.toISOString().slice(0, 10);
  return iso.replace(/-/g, "");
}

/**
 * Filename: FCB_ACH_SALARY_YYYYMMDD.txt (payment / effective date).
 */
export function buildFcbAchSalaryFileName(
  paymentDate: Date | string,
): string {
  return `FCB_ACH_SALARY_${formatAchPaymentDateYyyymmdd(paymentDate)}.txt`;
}

export function formatFcbLegacyExportLabel(
  formatId: FcbAchExportFormatId = FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
): string {
  switch (formatId) {
    case FCB_TT_DEFAULT_TRANSACTIONS_V1:
      return "FCB TT Default Transactions V1 (not implemented)";
    default:
      return "FCB TT Legacy NACHA – No Header V1";
  }
}

export function sliceAchField(
  record: string,
  slice: readonly [number, number],
): string {
  return record.slice(slice[0], slice[1]);
}
