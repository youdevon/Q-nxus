import { normalizeFirstCitizensPaymentTypeLabel } from "@/src/modules/payroll/lib/payment-instructions";
import type { AchExportSettings } from "@/src/modules/payroll/lib/ach/ach-settings";
import { isLegacyTransactionOverrideActive } from "@/src/modules/payroll/lib/ach/ach-settings";

export type AchCreditTransactionCode = "22" | "32";

function transactionCodeFromKnownAccountType(
  accountType: string | null | undefined,
): AchCreditTransactionCode | null {
  const normalized = accountType?.trim().toUpperCase() ?? "";
  if (
    normalized === "CHEQUING" ||
    normalized === "CHECKING" ||
    normalized === "CURRENT"
  ) {
    return "22";
  }
  if (normalized === "SAVINGS") {
    return "32";
  }
  return null;
}

/**
 * Resolve ACH credit transaction code.
 * 22 = checking/current credit, 32 = savings credit.
 * Does not guess unknown account types unless legacy override is active.
 */
export function resolveAchCreditTransactionCode(input: {
  paymentType?: string | null;
  accountType?: string | null;
  settings: AchExportSettings;
}): AchCreditTransactionCode | null {
  if (isLegacyTransactionOverrideActive(input.settings)) {
    return input.settings.legacyTransactionCode;
  }

  const fromLabel = normalizeFirstCitizensPaymentTypeLabel(input.paymentType);
  if (fromLabel === "Checking Credit") {
    return "22";
  }
  if (fromLabel === "Savings Credit") {
    return "32";
  }

  return transactionCodeFromKnownAccountType(input.accountType);
}
