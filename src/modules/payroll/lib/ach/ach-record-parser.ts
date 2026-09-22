import { fromCents } from "@/src/modules/payroll/lib/money";
import {
  FCB_LEGACY_FIELD_SLICES,
  FCB_LEGACY_RECORD_LENGTH,
  digitsOnly,
  sliceAchField,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import { AchRecordValidationError } from "@/src/modules/payroll/lib/ach/ach-record-builder";

export type ParsedFcbLegacyAchRecord = {
  recordType: string;
  transactionCode: string;
  receivingDfiId: string;
  checkDigit: string;
  routingNumber: string;
  /** Account digits as string (leading zeros preserved; trailing pad stripped). */
  accountNumber: string;
  /** Exact 10-digit cents field (leading zeros preserved). */
  amountInCents: string;
  amountDecimal: number;
  /**
   * Positions 40–54. Payment date belongs here (`SALARY YYYYMMDD`),
   * never in the trace number.
   */
  achIndividualIdentification: string;
  /** @deprecated Use achIndividualIdentification — kept for existing call sites. */
  identification: string;
  receiverName: string;
  discretionaryData: string;
  addendaIndicator: string;
  /**
   * Positions 80–94 as one opaque 15-digit ACH Trace Number.
   * Never split into employee-ref + payroll period / YYYYMM.
   */
  achTraceNumber: string;
  /** Alias of achTraceNumber. */
  traceNumber: string;
  /**
   * Payment date (YYYY-MM-DD) parsed only from Individual Identification.
   * Null when the field is not `SALARY YYYYMMDD`.
   */
  payrollPaymentDate: string | null;
  raw: string;
};

/**
 * Extract payment date from Individual Identification (`SALARY YYYYMMDD`).
 * Returns null when the field does not match — never falls back to the trace.
 */
export function extractPayrollPaymentDateFromIndividualIdentification(
  individualIdentification: string,
): string | null {
  const trimmed = individualIdentification.trimEnd();
  const match = /^SALARY\s+(\d{8})$/i.exec(trimmed);
  if (!match) {
    return null;
  }
  const yyyymmdd = match[1]!;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * Parse a single 94-character FCB legacy NACHA Entry Detail line
 * (CRLF stripped by caller) using fixed positions only.
 */
export function parseFcbLegacyAchRecord(line: string): ParsedFcbLegacyAchRecord {
  const raw = line.replace(/\r?\n$/, "");
  if (raw.length !== FCB_LEGACY_RECORD_LENGTH) {
    throw new AchRecordValidationError(
      `Expected ${FCB_LEGACY_RECORD_LENGTH}-character ACH record, got ${raw.length}.`,
    );
  }

  const recordType = sliceAchField(raw, FCB_LEGACY_FIELD_SLICES.recordType);
  const transactionCode = sliceAchField(
    raw,
    FCB_LEGACY_FIELD_SLICES.transactionCode,
  );
  const receivingDfiId = sliceAchField(
    raw,
    FCB_LEGACY_FIELD_SLICES.receivingDfiId,
  );
  const checkDigit = sliceAchField(raw, FCB_LEGACY_FIELD_SLICES.checkDigit);
  const accountField = sliceAchField(raw, FCB_LEGACY_FIELD_SLICES.accountNumber);
  const amountInCents = sliceAchField(raw, FCB_LEGACY_FIELD_SLICES.amountCents);
  const individualIdentification = sliceAchField(
    raw,
    FCB_LEGACY_FIELD_SLICES.individualIdentification,
  );
  const receiverName = sliceAchField(raw, FCB_LEGACY_FIELD_SLICES.receiverName);
  const discretionaryData = sliceAchField(
    raw,
    FCB_LEGACY_FIELD_SLICES.discretionaryData,
  );
  const addendaIndicator = sliceAchField(
    raw,
    FCB_LEGACY_FIELD_SLICES.addendaIndicator,
  );
  // Opaque 15-digit string — preserve leading zeros; do not interpret as a date.
  const achTraceNumber = digitsOnly(
    sliceAchField(raw, FCB_LEGACY_FIELD_SLICES.achTraceNumber),
  );

  const cents = Number.parseInt(amountInCents, 10);
  if (!Number.isFinite(cents)) {
    throw new AchRecordValidationError("Amount field is not numeric.");
  }

  const identificationTrimmed = individualIdentification.trimEnd();

  return {
    recordType,
    transactionCode,
    receivingDfiId,
    checkDigit,
    routingNumber: `${receivingDfiId}${checkDigit}`,
    accountNumber: accountField.trimEnd(),
    amountInCents,
    amountDecimal: fromCents(cents),
    achIndividualIdentification: identificationTrimmed,
    identification: identificationTrimmed,
    receiverName: receiverName.trimEnd(),
    discretionaryData,
    addendaIndicator,
    achTraceNumber,
    traceNumber: achTraceNumber,
    payrollPaymentDate:
      extractPayrollPaymentDateFromIndividualIdentification(
        individualIdentification,
      ),
    raw,
  };
}
