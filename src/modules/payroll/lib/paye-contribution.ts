/** Trinidad & Tobago PAYE (income tax) calculation helpers (client-safe). */

import { roundToCents } from "@/src/modules/payroll/lib/money";

export type PayeTaxBracketRecord = {
  id: string;
  upToAmount: string | null;
  ratePercent: string;
  sortOrder: number;
};

/** Serializable PAYE config passed from server pages into client components. */
export type PayeTaxConfigRecord = {
  id: string;
  countryCode: string;
  taxYear: number;
  currencyCode: string;
  personalAllowanceAnnual: string;
  nisDeductiblePortion: string;
  approvedDeductionCapAnnual: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  sourceReference: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  isActive: boolean;
  isCurrent: boolean;
  brackets: PayeTaxBracketRecord[];
};

export type PayeTaxBracketInput = {
  /** Upper bound of chargeable income for this band (inclusive). Null = open-ended. */
  upToAmount: number | null;
  ratePercent: number;
  sortOrder?: number;
};

export type PayeTaxConfigInput = {
  personalAllowanceAnnual: number;
  /** Fraction of employee NIS that is deductible (e.g. 0.70). */
  nisDeductiblePortion: number;
  approvedDeductionCapAnnual: number;
  brackets: PayeTaxBracketInput[];
};

export function toPayeConfigInput(
  record: PayeTaxConfigRecord,
): PayeTaxConfigInput {
  return {
    personalAllowanceAnnual: Number(record.personalAllowanceAnnual),
    nisDeductiblePortion: Number(record.nisDeductiblePortion),
    approvedDeductionCapAnnual: Number(record.approvedDeductionCapAnnual),
    brackets: record.brackets.map((bracket) => ({
      upToAmount:
        bracket.upToAmount != null ? Number(bracket.upToAmount) : null,
      ratePercent: Number(bracket.ratePercent),
      sortOrder: bracket.sortOrder,
    })),
  };
}

export type PayeContributionResult = {
  annualTaxableIncome: number;
  personalAllowance: number;
  employeeNisAnnual: number;
  nisDeductible: number;
  otherApprovedDeductions: number;
  approvedDeductionsApplied: number;
  chargeableIncome: number;
  annualTax: number;
  monthlyPaye: number;
};

function sortBrackets(brackets: PayeTaxBracketInput[]): PayeTaxBracketInput[] {
  return [...brackets].sort(
    (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
  );
}

/**
 * Apply progressive brackets to chargeable income.
 * Brackets are ordered low→high; each band taxes income up to its upToAmount.
 */
export function computeTaxOnChargeableIncome(
  chargeableIncome: number,
  brackets: PayeTaxBracketInput[],
): number {
  if (!Number.isFinite(chargeableIncome) || chargeableIncome <= 0) {
    return 0;
  }

  const ordered = sortBrackets(brackets);
  let remaining = chargeableIncome;
  let previousCap = 0;
  let tax = 0;

  for (const bracket of ordered) {
    if (remaining <= 0) {
      break;
    }

    const bandCeiling =
      bracket.upToAmount == null
        ? Number.POSITIVE_INFINITY
        : bracket.upToAmount;
    const bandWidth = bandCeiling - previousCap;

    if (bandWidth <= 0) {
      previousCap = bandCeiling;
      continue;
    }

    const taxableInBand = Math.min(remaining, bandWidth);
    tax += taxableInBand * (bracket.ratePercent / 100);
    remaining -= taxableInBand;
    previousCap = bandCeiling;
  }

  return roundToCents(tax);
}

/**
 * Estimate annual PAYE from taxable employment income and optional NIS/TD1 deductions.
 *
 * Taxable income is annualised monthly taxable earnings (base salary plus
 * taxable allowances / variable earnings) × 12.
 * OT/bonuses/commissions deferred unless entered as taxable run lines.
 *
 * NIS deductible = min(employeeWeeklyNIS × 52 × nisDeductiblePortion, remaining cap room)
 * combined with other TD1 approved deductions under approvedDeductionCapAnnual.
 */
export function computePayeContribution(input: {
  /** Monthly taxable employment earnings (base + taxable allowances/lines). */
  monthlyTaxableEarnings: number;
  config: PayeTaxConfigInput;
  /** Employee NIS weekly amount from earnings class (0 if none). */
  employeeNisWeekly?: number;
  /** Other TD1 approved deductions (annual), e.g. pension/annuity. */
  otherApprovedDeductionsAnnual?: number;
}): PayeContributionResult {
  const annualTaxableIncome = roundToCents(input.monthlyTaxableEarnings * 12);
  const personalAllowance = input.config.personalAllowanceAnnual;
  const employeeNisWeekly = input.employeeNisWeekly ?? 0;
  const employeeNisAnnual = roundToCents(employeeNisWeekly * 52);
  const nisDeductibleGross = roundToCents(
    employeeNisAnnual * input.config.nisDeductiblePortion,
  );
  const otherApprovedDeductions = roundToCents(
    Math.max(0, input.otherApprovedDeductionsAnnual ?? 0),
  );

  const combinedBeforeCap = roundToCents(
    nisDeductibleGross + otherApprovedDeductions,
  );
  const approvedDeductionsApplied = roundToCents(
    Math.min(combinedBeforeCap, input.config.approvedDeductionCapAnnual),
  );

  // Prefer applying NIS deductible within the combined cap when capping.
  const nisDeductible = roundToCents(
    Math.min(nisDeductibleGross, approvedDeductionsApplied),
  );

  const chargeableIncome = roundToCents(
    Math.max(
      0,
      annualTaxableIncome - personalAllowance - approvedDeductionsApplied,
    ),
  );

  const annualTax = computeTaxOnChargeableIncome(
    chargeableIncome,
    input.config.brackets,
  );
  const monthlyPaye = roundToCents(annualTax / 12);

  return {
    annualTaxableIncome,
    personalAllowance,
    employeeNisAnnual,
    nisDeductible,
    otherApprovedDeductions,
    approvedDeductionsApplied,
    chargeableIncome,
    annualTax,
    monthlyPaye,
  };
}

/** Seed defaults matching T&T individual rates (2026). */
export const TT_PAYE_2026_CONFIG: PayeTaxConfigInput = {
  personalAllowanceAnnual: 90_000,
  nisDeductiblePortion: 0.7,
  approvedDeductionCapAnnual: 60_000,
  brackets: [
    { upToAmount: 1_000_000, ratePercent: 25, sortOrder: 0 },
    { upToAmount: null, ratePercent: 30, sortOrder: 1 },
  ],
};
