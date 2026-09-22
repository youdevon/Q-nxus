/**
 * Account number string helpers for FCB TT ACH (never numeric-cast).
 */

import { digitsOnly } from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import {
  FCB_LEGACY_FIELD_WIDTHS,
  padRightFixed,
} from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import { defaultAchAccountLength } from "@/src/modules/payroll/lib/ach/ach-account-length-defaults";
import type { AchRoutingParticipant } from "@/src/modules/payroll/lib/ach/ach-routing";
import { AchRecordValidationError } from "@/src/modules/payroll/lib/ach/ach-errors";

/** Strip spaces/dashes; keep digits only. Reject any leftover non-digits in source intent. */
export function normalizeAchAccountDigits(accountNumber: string): string {
  const stripped = accountNumber.replace(/[\s\-]/g, "");
  if (/[^\d]/.test(stripped)) {
    throw new AchRecordValidationError(
      "Account number must contain digits only (spaces and dashes are stripped; other characters are rejected).",
    );
  }
  return digitsOnly(stripped);
}

export function formatAchAccountNumberStrict(accountNumber: string): string {
  const digits = normalizeAchAccountDigits(accountNumber);
  if (!digits) {
    throw new AchRecordValidationError("Account number is required.");
  }
  if (digits.length > FCB_LEGACY_FIELD_WIDTHS.accountNumber) {
    throw new AchRecordValidationError(
      `Account number exceeds ${FCB_LEGACY_FIELD_WIDTHS.accountNumber} characters.`,
    );
  }
  return padRightFixed(digits, FCB_LEGACY_FIELD_WIDTHS.accountNumber);
}

export type AchAccountLengthWarning = {
  code: "ACCOUNT_LENGTH";
  message: string;
  participant: AchRoutingParticipant | null;
};

/** Per-bank length guidance — warnings only. */
export function detectAchAccountLengthWarnings(input: {
  accountDigits: string;
  routingNumber: string | null | undefined;
  participant?: AchRoutingParticipant | null;
}): AchAccountLengthWarning[] {
  const warnings: AchAccountLengthWarning[] = [];
  const len = input.accountDigits.length;
  const participant = input.participant;
  const defaults = defaultAchAccountLength(input.routingNumber ?? "");

  if (!participant) {
    if (len < defaults.min || len > defaults.max) {
      warnings.push({
        code: "ACCOUNT_LENGTH",
        message: `Account length ${len} is unusual (expected ${defaults.min}–${defaults.max} digits when bank-specific rules are unknown).`,
        participant: null,
      });
    }
    return warnings;
  }

  const { min, max, note } = participant.accountDigits;
  if (len < min || len > max) {
    warnings.push({
      code: "ACCOUNT_LENGTH",
      message: `${participant.shortName} account length ${len} is outside expected ${min}–${max}. ${note}`,
      participant,
    });
  }
  return warnings;
}

export function accountLast4(accountDigits: string): string {
  const digits = digitsOnly(accountDigits);
  if (digits.length <= 4) {
    return digits;
  }
  return digits.slice(-4);
}
