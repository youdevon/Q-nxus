/**
 * Helpers for entering prior-employer payslip YTD into EmployeePriorEmploymentYtd.
 *
 * Canonical field for PAYE is always `taxableIncomeYtd`.
 * Worksheet mode stores gross + non-taxable so staff can re-check the slip later.
 */

import { roundToCents } from "@/src/modules/payroll/lib/money";

export type PriorTaxableIncomeEntryMode = "DIRECT" | "WORKSHEET";

export type PriorPayslipWorksheetInput = {
  entryMode: PriorTaxableIncomeEntryMode;
  /** Direct taxable / YTD PAY when entryMode is DIRECT. */
  taxableIncomeYtd?: number | null;
  /** YTD GRS / total earnings when entryMode is WORKSHEET. */
  grossEarningsYtd?: number | null;
  /** Travelling / YTD ALL / other non-taxable allowances YTD. */
  nonTaxableAllowancesYtd?: number | null;
};

export type PriorPayslipWorksheetResult = {
  taxableIncomeYtd: number;
  grossEarningsYtd: number | null;
  nonTaxableAllowancesYtd: number | null;
  entryMode: PriorTaxableIncomeEntryMode;
};

export type PriorPayslipValidationWarning = {
  code:
    | "TAXABLE_EXCEEDS_GROSS"
    | "NON_TAXABLE_EXCEEDS_GROSS"
    | "WORKSHEET_ZERO_TAXABLE"
    | "MISSING_GROSS_FOR_WORKSHEET";
  message: string;
};

function nonNegative(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, value);
}

/**
 * Resolve taxable YTD from either a direct payslip label (YTD PAY)
 * or gross − non-taxable worksheet.
 */
export function resolvePriorTaxableFromPayslip(
  input: PriorPayslipWorksheetInput,
): PriorPayslipWorksheetResult {
  if (input.entryMode === "WORKSHEET") {
    const gross = nonNegative(input.grossEarningsYtd) ?? 0;
    const nonTaxable = nonNegative(input.nonTaxableAllowancesYtd) ?? 0;
    const taxable = roundToCents(Math.max(0, gross - nonTaxable));
    return {
      entryMode: "WORKSHEET",
      taxableIncomeYtd: taxable,
      grossEarningsYtd: roundToCents(gross),
      nonTaxableAllowancesYtd: roundToCents(nonTaxable),
    };
  }

  const taxable = roundToCents(nonNegative(input.taxableIncomeYtd) ?? 0);
  const gross = nonNegative(input.grossEarningsYtd);
  const nonTaxable = nonNegative(input.nonTaxableAllowancesYtd);

  return {
    entryMode: "DIRECT",
    taxableIncomeYtd: taxable,
    grossEarningsYtd: gross != null ? roundToCents(gross) : null,
    nonTaxableAllowancesYtd:
      nonTaxable != null ? roundToCents(nonTaxable) : null,
  };
}

/** Soft checks — never block save; surface on the form for review. */
export function validatePriorPayslipWorksheet(
  input: PriorPayslipWorksheetResult,
): PriorPayslipValidationWarning[] {
  const warnings: PriorPayslipValidationWarning[] = [];

  if (input.entryMode === "WORKSHEET") {
    if (input.grossEarningsYtd == null || input.grossEarningsYtd <= 0) {
      warnings.push({
        code: "MISSING_GROSS_FOR_WORKSHEET",
        message:
          "Worksheet mode needs gross / total earnings YTD from the payslip.",
      });
    }
    if (
      input.grossEarningsYtd != null &&
      input.nonTaxableAllowancesYtd != null &&
      input.nonTaxableAllowancesYtd > input.grossEarningsYtd
    ) {
      warnings.push({
        code: "NON_TAXABLE_EXCEEDS_GROSS",
        message:
          "Non-taxable allowances YTD is greater than gross earnings YTD.",
      });
    }
    if (input.taxableIncomeYtd <= 0) {
      warnings.push({
        code: "WORKSHEET_ZERO_TAXABLE",
        message:
          "Computed taxable YTD is zero. Check travelling/allowances were not overstated.",
      });
    }
  }

  if (
    input.grossEarningsYtd != null &&
    input.taxableIncomeYtd > input.grossEarningsYtd + 0.009
  ) {
    warnings.push({
      code: "TAXABLE_EXCEEDS_GROSS",
      message:
        "Taxable YTD is higher than gross earnings YTD — unusual; confirm the slip labels.",
    });
  }

  return warnings;
}

/** Payslip label aliases shown under form fields. */
export const PRIOR_PAYSLIP_FIELD_HINTS = {
  grossEarningsYtd:
    "YTD GRS, Gross Pay YTD, or total earnings YTD (includes travelling).",
  nonTaxableAllowancesYtd:
    "Travelling YTD, YTD ALL, or other non-taxable allowances. Leave 0 if none.",
  taxableIncomeYtd:
    "YTD PAY / taxable earnings only — never net pay, and usually not full gross when travelling is separate.",
  payeDeductedYtd: "YTD TAX / YTD P.A.Y.E. / PAYE AS YOU EARN YTD.",
  nisEmployeeYtd: "YTD NIS / T&T NIS employee YTD.",
  healthSurchargeYtd: "YTD H/S / T&T H/SC / Health Surcharge YTD.",
  asOfDate: "Pay period end date on the last prior-employer payslip.",
  doNotEnter:
    "Do not enter net pay as taxable. Loans and voluntary deductions are not statutory YTD.",
} as const;
