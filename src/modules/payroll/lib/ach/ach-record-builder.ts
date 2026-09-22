import { toCents } from "@/src/modules/payroll/lib/money";
import {
  FCB_LEGACY_FIELD_WIDTHS,
  FCB_LEGACY_RECORD_LENGTH,
  digitsOnly,
  formatAchPaymentDateYyyymmdd,
  padLeftFixed,
  padRightFixed,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import { formatAchAccountNumberStrict } from "@/src/modules/payroll/lib/ach/ach-account";
import { formatAchReceiverNameParts } from "@/src/modules/payroll/lib/ach/ach-name";
import { AchRecordValidationError } from "@/src/modules/payroll/lib/ach/ach-errors";
import {
  validateFcbTtAchRouting,
  type AchRoutingParticipant,
} from "@/src/modules/payroll/lib/ach/ach-routing";
import type { AchParticipantBank } from "@/src/modules/payroll/lib/ach/ach-participant-types";
import {
  FCB_TT_MAX_ENTRY_AMOUNT_CENTS,
  FCB_TT_MIN_ENTRY_AMOUNT_CENTS,
  type FcbAchNameFormat,
} from "@/src/modules/payroll/lib/ach/fcb-tt-config";

export { AchRecordValidationError } from "@/src/modules/payroll/lib/ach/ach-errors";

/**
 * NACHA Individual Name (22): sanitised FIRST + two spaces + LAST by default.
 * Truncation is export-only; does not mutate stored employee names.
 */
export function formatAchReceiverName(
  name: string,
  format: FcbAchNameFormat = "FIRST_TWO_SPACES_LAST",
): string {
  return formatAchReceiverNameParts(name, format);
}

/** Warn when source name may not survive a bank text-file interface. */
export function detectAchReceiverNameWarnings(name: string): string[] {
  const warnings: string[] = [];
  const trimmed = name.trim();
  if (!trimmed) {
    return ["Receiver name is empty."];
  }
  const sanitised = formatAchReceiverNameParts(trimmed).trimEnd();
  if (!sanitised) {
    warnings.push(
      "Receiver name has no allowed characters after sanitising (A–Z, 0–9, space, hyphen, apostrophe, period).",
    );
  }
  if (/[^\x20-\x7E]/.test(trimmed)) {
    warnings.push(
      "Receiver name contained non-ASCII characters that were transliterated or stripped for the ACH file.",
    );
  }
  if (trimmed.length > FCB_LEGACY_FIELD_WIDTHS.receiverName) {
    warnings.push(
      `Receiver name exceeds ${FCB_LEGACY_FIELD_WIDTHS.receiverName} characters and will be truncated in the ACH file only.`,
    );
  }
  return warnings;
}

/**
 * Individual Identification (positions 40–54): `SALARY YYYYMMDD`.
 * This is the only place the payroll / payment date is encoded on the detail line.
 */
export function formatAchSalaryReference(
  paymentDate: Date | string,
  entryDescription = "Salary",
): string {
  const yyyymmdd = formatAchPaymentDateYyyymmdd(paymentDate);
  const prefix = entryDescription.trim().toUpperCase().replace(/\s+/g, " ");
  const value = padRightFixed(`${prefix} ${yyyymmdd}`.trim(), 15);
  if (value.length !== 15) {
    throw new AchRecordValidationError(
      `Individual Identification (SALARY reference) must be exactly 15 characters (got ${value.length}).`,
    );
  }
  return value;
}

export function normalizeAchRoutingNumber(
  value: string | null | undefined,
): string | null {
  const result = validateFcbTtAchRouting(value);
  return result.ok ? result.routing : null;
}

/**
 * Format amount as 10-digit cents. Accepts currency units or integer cents via options.
 * Rejects ≤ $0.00 and ≥ $500,000.00 (Central Bank threshold).
 */
export function formatAchAmountCents(
  amount: number,
  options?: { employeeLabel?: string; amountAlreadyCents?: boolean },
): string | null {
  const cents = options?.amountAlreadyCents
    ? Math.trunc(amount)
    : toCents(amount);
  const label = options?.employeeLabel?.trim();
  if (!(cents >= FCB_TT_MIN_ENTRY_AMOUNT_CENTS)) {
    return null;
  }
  if (cents >= FCB_TT_MAX_ENTRY_AMOUNT_CENTS) {
    if (label) {
      throw new AchRecordValidationError(
        `ACH amount for ${label} must be less than $500,000.00 (got ${cents} cents).`,
      );
    }
    return null;
  }
  if (cents > 9_999_999_999) {
    return null;
  }
  return padLeftFixed(String(cents), FCB_LEGACY_FIELD_WIDTHS.amountCents);
}

/** Assert amount in cents is within FCB TT / CBTT bounds; names the employee. */
export function assertAchAmountCentsAllowed(
  amountCents: number,
  employeeLabel: string,
): void {
  const label = employeeLabel.trim() || "employee";
  if (!(amountCents >= FCB_TT_MIN_ENTRY_AMOUNT_CENTS)) {
    throw new AchRecordValidationError(
      `ACH amount for ${label} must be greater than $0.00.`,
    );
  }
  if (amountCents >= FCB_TT_MAX_ENTRY_AMOUNT_CENTS) {
    throw new AchRecordValidationError(
      `ACH amount for ${label} must be less than $500,000.00 (Central Bank threshold).`,
    );
  }
}

/**
 * Account number as string, right-padded with spaces to 17.
 * Never convert to a number — leading zeros are significant.
 */
export function formatAchAccountNumber(accountNumber: string): string {
  return formatAchAccountNumberStrict(accountNumber);
}

export type AchType6RecordInput = {
  transactionCode: "22" | "32";
  routingNumber: string;
  accountNumber: string;
  /** Prefer amountCents; `amount` (currency units) kept for backward compatibility. */
  amount?: number;
  amountCents?: number;
  /** Positions 40–54 — typically `SALARY YYYYMMDD`. */
  individualId: string;
  receiverName: string;
  nameFormat?: FcbAchNameFormat;
  discretionaryData?: string;
  addendaIndicator?: "0" | "1";
  /**
   * Positions 80–94 — opaque 15-digit ACH Trace Number string.
   * Must not encode / derive the payroll payment date.
   */
  traceNumber: string;
  /** Included in length-validation messages only. */
  employeeLabel?: string;
  /** Production: pass DB ACH bank registry so manually added banks validate. */
  routingRegistry?:
    | ReadonlyMap<string, AchRoutingParticipant | AchParticipantBank>
    | readonly (AchRoutingParticipant | AchParticipantBank)[];
};

/** One 94-character NACHA Entry Detail (record type 6). */
export function buildFcbLegacyAchRecord(input: AchType6RecordInput): string {
  const label = input.employeeLabel?.trim() || "employee";
  const routingResult = validateFcbTtAchRouting(
    input.routingNumber,
    input.routingRegistry,
  );
  if (!routingResult.ok) {
    throw new AchRecordValidationError(
      `ACH record validation failed for ${label}: ${routingResult.error}`,
    );
  }
  const routing = routingResult.routing;

  let cents: number;
  if (input.amountCents != null) {
    cents = Math.trunc(input.amountCents);
  } else if (input.amount != null) {
    cents = toCents(input.amount);
  } else {
    throw new AchRecordValidationError(
      `ACH record validation failed for ${label}: amount is required.`,
    );
  }
  assertAchAmountCentsAllowed(cents, label);
  const amount = padLeftFixed(String(cents), FCB_LEGACY_FIELD_WIDTHS.amountCents);

  // Trace is an opaque identifier string — never inject payment-date digits here.
  const trace = digitsOnly(input.traceNumber);
  if (trace.length !== FCB_LEGACY_FIELD_WIDTHS.traceNumber) {
    throw new AchRecordValidationError(
      `ACH record validation failed for ${label}: Trace Number must be exactly ${FCB_LEGACY_FIELD_WIDTHS.traceNumber} numeric digits (got ${trace.length}).`,
    );
  }

  const discretionary = padRightFixed(
    input.discretionaryData ?? "  ",
    FCB_LEGACY_FIELD_WIDTHS.discretionaryData,
  );
  const addenda = input.addendaIndicator ?? "0";
  if (addenda !== "0" && addenda !== "1") {
    throw new AchRecordValidationError(
      `ACH record validation failed for ${label}: Addenda indicator must be 0 or 1.`,
    );
  }

  const individualId = padRightFixed(
    input.individualId,
    FCB_LEGACY_FIELD_WIDTHS.individualId,
  );
  const receiverName = formatAchReceiverName(
    input.receiverName,
    input.nameFormat ?? "FIRST_TWO_SPACES_LAST",
  );
  const account = formatAchAccountNumber(input.accountNumber);

  // Assemble from fixed-width parts only — never silently trim the final line.
  const parts = {
    recordType: "6",
    transactionCode: input.transactionCode,
    receivingDfiId: routing.slice(0, 8),
    checkDigit: routing.slice(8, 9),
    accountNumber: account,
    amountCents: amount,
    individualIdentification: individualId,
    receiverName,
    discretionaryData: discretionary,
    addendaIndicator: addenda,
    achTraceNumber: trace,
  };

  for (const [field, value] of Object.entries(parts)) {
    const expected =
      field === "recordType"
        ? 1
        : field === "transactionCode"
          ? 2
          : field === "receivingDfiId"
            ? 8
            : field === "checkDigit"
              ? 1
              : field === "accountNumber"
                ? 17
                : field === "amountCents"
                  ? 10
                  : field === "individualIdentification"
                    ? 15
                    : field === "receiverName"
                      ? 22
                      : field === "discretionaryData"
                        ? 2
                        : field === "addendaIndicator"
                          ? 1
                          : 15;
    if (value.length !== expected) {
      throw new AchRecordValidationError(
        `ACH record validation failed for ${label}: field ${field} length ${value.length}, expected ${expected}.`,
      );
    }
  }

  const record = [
    parts.recordType,
    parts.transactionCode,
    parts.receivingDfiId,
    parts.checkDigit,
    parts.accountNumber,
    parts.amountCents,
    parts.individualIdentification,
    parts.receiverName,
    parts.discretionaryData,
    parts.addendaIndicator,
    parts.achTraceNumber,
  ].join("");

  if (record.length !== FCB_LEGACY_RECORD_LENGTH) {
    throw new AchRecordValidationError(
      `ACH record validation failed for ${label}: expected ${FCB_LEGACY_RECORD_LENGTH} characters, generated ${record.length}.`,
    );
  }
  return record;
}
