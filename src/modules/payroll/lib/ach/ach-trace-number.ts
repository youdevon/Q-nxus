/**
 * Pure ACH trace helpers — no DB.
 *
 * ## Verification status (IMPORTANT)
 *
 * Positions 80–94 are one opaque 15-digit ACH Trace Number string.
 * Digits that resemble a period (e.g. `…202608`) inside EasyPay samples are
 * coincidental — never treat them as YYYYMM / payroll date.
 *
 * `CONFIGURED_PREFIX_SEQUENCE` (ODFI routing first 8 + 7-digit org sequence)
 * is an explicit, configurable stand-in so exports are possible. It is **not**
 * a verified First Citizens / EasyPay algorithm. Replace or reconfigure only
 * from bank-confirmed guidance. Never embed the payroll payment date into the
 * trace merely to mimic sample files.
 */

import {
  digitsOnly,
  padLeftFixed,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import { AchRecordValidationError } from "@/src/modules/payroll/lib/ach/ach-record-builder";

export type AchTraceNumberGenerator = {
  /** Peek next value without consuming (for preview). */
  peekNext(count: number): Promise<string[]>;
  /** Allocate and persist the next `count` traces. */
  allocate(count: number): Promise<string[]>;
};

export const ACH_TRACE_GENERATION_REQUIRES_FCB_VERIFICATION = true;

export function odfiTracePrefix(odfiRoutingNumber: string): string {
  const routing = digitsOnly(odfiRoutingNumber);
  if (routing.length !== 9) {
    throw new AchRecordValidationError(
      "ODFI routing number must be exactly 9 digits before generating traces.",
    );
  }
  return routing.slice(0, 8);
}

/**
 * Build a 15-digit configured-prefix trace (ODFI8 + seq7).
 * Does not accept or encode a payment date.
 */
export function buildConfiguredPrefixTrace(
  odfiRoutingNumber: string,
  sequence: number,
): string {
  const prefix = odfiTracePrefix(odfiRoutingNumber);
  const seq = Math.max(1, Math.trunc(sequence));
  return `${prefix}${padLeftFixed(String(seq), 7)}`;
}

export function assertValidTraceNumber(trace: string): void {
  const digits = digitsOnly(trace);
  if (digits.length !== 15 || digits !== trace) {
    throw new AchRecordValidationError(
      "ACH Trace Number must be exactly 15 numeric digits (string; leading zeros preserved).",
    );
  }
}
