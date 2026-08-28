/**
 * Employee Annual PAYE Projection worksheet (calendar tax year).
 *
 * Canonical method for mid-year joiners from another employer:
 *   annual taxable = prior taxable YTD + current posted YTD + projected remaining
 *   chargeable     = annual taxable − personal allowance − qualifying (70% NIS / TD1 / pension, capped)
 *   remaining tax  = annual tax − prior PAYE − current PAYE
 *   PAYE / period  = remaining tax ÷ remaining payroll periods
 *
 * Distinguishes:
 * A) Previous-employer actual (verified)
 * B) Current-employer actual YTD
 * C) Projected remaining current-employer
 * D) Combined projected calendar-year
 */

import {
  computeTaxOnChargeableIncome,
  type PayeTaxConfigInput,
} from "@/src/modules/payroll/lib/paye-contribution";
import { roundToCents } from "@/src/modules/payroll/lib/money";
import {
  computeQualifyingDeductionBreakdown,
  type QualifyingDeductionBreakdown,
} from "@/src/modules/payroll/lib/qualifying-deductions";
import {
  resolveRemainingPayrollPeriods,
  type PayFrequencyCode,
  type RemainingPayrollPeriodsResult,
} from "@/src/modules/payroll/lib/remaining-payroll-periods";

export type AnnualPayeProjectionBucket = {
  taxableEarnings: number;
  paye: number;
  employeeNis: number;
  pensionContribution: number;
  otherQualifyingContribution: number;
};

export type AnnualPayeProjectionInput = {
  taxYear: number;
  asOfDate: Date;
  payFrequency: PayFrequencyCode;
  employmentStartDate?: Date | null;
  employmentEndDate?: Date | null;
  config: PayeTaxConfigInput;
  /** Personal allowance override (employee tax profile); null = use config. */
  personalAllowanceOverride?: number | null;
  previousEmployer: AnnualPayeProjectionBucket;
  /** When false, previousEmployer amounts must be zero for applied calc. */
  previousEmployerVerified: boolean;
  includeUnverifiedPreviousInPreview?: boolean;
  currentEmployerActual: AnnualPayeProjectionBucket;
  /**
   * Expected taxable earnings per remaining payroll period
   * (basic + recurring taxable only by default).
   */
  projectedTaxablePerRemainingPeriod: number;
  /** Expected employee NIS per remaining period. */
  projectedNisPerRemainingPeriod?: number;
  /** Expected pension per remaining period. */
  projectedPensionPerRemainingPeriod?: number;
  /** TD1 / other approved annual (current employer entitlement). */
  td1OtherApprovedAnnual?: number;
  /** Manual tax adjustment (+ increases remaining liability). */
  manualTaxAdjustment?: number;
  /**
   * Optional formula overrides (approved tax-year adjustments / IRD instruction).
   * Use when statutory schedule is correct org-wide but this employee needs a
   * different portion, cap, or remaining-period count.
   */
  formulaOverrides?: {
    /** Absolute remaining payroll periods (replaces computed count). */
    remainingPeriods?: number | null;
    /** Absolute NIS deductible portion 0–1 (replaces config). */
    nisDeductiblePortion?: number | null;
    /** Absolute approved deduction cap annual (replaces config). */
    approvedDeductionCapAnnual?: number | null;
  };
};

export type AnnualPayeProjectionResult = {
  taxYear: number;
  calculationDate: string;
  periods: RemainingPayrollPeriodsResult;
  previousEmployer: AnnualPayeProjectionBucket;
  currentEmployerActual: AnnualPayeProjectionBucket;
  projectedRemaining: AnnualPayeProjectionBucket;
  projectedAnnual: AnnualPayeProjectionBucket;
  personalAllowance: number;
  qualifying: QualifyingDeductionBreakdown;
  projectedChargeableIncome: number;
  taxByBand: { ratePercent: number; taxAmount: number }[];
  projectedAnnualTaxLiability: number;
  previousEmployerPaye: number;
  currentEmployerPaye: number;
  manualTaxAdjustment: number;
  remainingTaxLiability: number;
  recommendedPayePerPeriod: number | null;
  warnings: string[];
  /** True when previous unverified figures were excluded from the math. */
  previousEmployerExcludedUnverified: boolean;
};

function emptyBucket(): AnnualPayeProjectionBucket {
  return {
    taxableEarnings: 0,
    paye: 0,
    employeeNis: 0,
    pensionContribution: 0,
    otherQualifyingContribution: 0,
  };
}

function scaleBucket(
  perPeriod: {
    taxable: number;
    nis: number;
    pension: number;
  },
  periods: number,
): AnnualPayeProjectionBucket {
  return {
    taxableEarnings: roundToCents(Math.max(0, perPeriod.taxable) * periods),
    paye: 0,
    employeeNis: roundToCents(Math.max(0, perPeriod.nis) * periods),
    pensionContribution: roundToCents(Math.max(0, perPeriod.pension) * periods),
    otherQualifyingContribution: 0,
  };
}

function sumBuckets(
  ...buckets: AnnualPayeProjectionBucket[]
): AnnualPayeProjectionBucket {
  return buckets.reduce(
    (acc, bucket) => ({
      taxableEarnings: roundToCents(acc.taxableEarnings + bucket.taxableEarnings),
      paye: roundToCents(acc.paye + bucket.paye),
      employeeNis: roundToCents(acc.employeeNis + bucket.employeeNis),
      pensionContribution: roundToCents(
        acc.pensionContribution + bucket.pensionContribution,
      ),
      otherQualifyingContribution: roundToCents(
        acc.otherQualifyingContribution + bucket.otherQualifyingContribution,
      ),
    }),
    emptyBucket(),
  );
}

function taxBandsBreakdown(
  chargeableIncome: number,
  config: PayeTaxConfigInput,
): { ratePercent: number; taxAmount: number }[] {
  const ordered = [...config.brackets].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  let remaining = Math.max(0, chargeableIncome);
  let previousCap = 0;
  const rows: { ratePercent: number; taxAmount: number }[] = [];

  for (const bracket of ordered) {
    if (remaining <= 0) {
      rows.push({ ratePercent: bracket.ratePercent, taxAmount: 0 });
      continue;
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
    rows.push({
      ratePercent: bracket.ratePercent,
      taxAmount: roundToCents(taxableInBand * (bracket.ratePercent / 100)),
    });
    remaining -= taxableInBand;
    previousCap = bandCeiling;
  }

  return rows;
}

export function computeAnnualPayeProjection(
  input: AnnualPayeProjectionInput,
): AnnualPayeProjectionResult {
  const warnings: string[] = [];
  const periodsBase = resolveRemainingPayrollPeriods({
    taxYear: input.taxYear,
    asOfDate: input.asOfDate,
    payFrequency: input.payFrequency,
    employmentStartDate: input.employmentStartDate,
    employmentEndDate: input.employmentEndDate,
  });
  warnings.push(...periodsBase.notes);

  const remainingOverride = input.formulaOverrides?.remainingPeriods;
  const periods: RemainingPayrollPeriodsResult =
    remainingOverride != null && Number.isFinite(remainingOverride)
      ? {
          ...periodsBase,
          remainingPeriods: Math.max(0, Math.floor(remainingOverride)),
          notes: [
            ...periodsBase.notes,
            `Remaining periods overridden to ${Math.max(0, Math.floor(remainingOverride))} (manual formula override).`,
          ],
        }
      : periodsBase;

  if (
    remainingOverride != null &&
    Number.isFinite(remainingOverride) &&
    periods.remainingPeriods !== periodsBase.remainingPeriods
  ) {
    warnings.push(
      `Remaining periods manually overridden (${periodsBase.remainingPeriods} → ${periods.remainingPeriods}).`,
    );
  }

  let previousEmployer = { ...input.previousEmployer };
  let previousEmployerExcludedUnverified = false;

  if (!input.previousEmployerVerified) {
    const hasPrior =
      previousEmployer.taxableEarnings > 0 || previousEmployer.paye > 0;
    if (hasPrior) {
      if (input.includeUnverifiedPreviousInPreview) {
        warnings.push(
          "Previous-employer figures are unverified — shown for preview only; they must not apply to approved payroll until verified.",
        );
      } else {
        previousEmployer = emptyBucket();
        previousEmployerExcludedUnverified = true;
        warnings.push(
          "Unverified previous-employer figures were excluded from this calculation.",
        );
      }
    }
  }

  const projectedRemaining = scaleBucket(
    {
      taxable: input.projectedTaxablePerRemainingPeriod,
      nis: input.projectedNisPerRemainingPeriod ?? 0,
      pension: input.projectedPensionPerRemainingPeriod ?? 0,
    },
    periods.remainingPeriods,
  );

  const currentEmployerActual = { ...input.currentEmployerActual };
  const projectedAnnual = sumBuckets(
    previousEmployer,
    currentEmployerActual,
    projectedRemaining,
  );

  if (
    projectedAnnual.taxableEarnings <
    previousEmployer.taxableEarnings + currentEmployerActual.taxableEarnings
  ) {
    warnings.push("Projected annual taxable earnings are below actual YTD.");
  }

  if (periods.remainingPeriods === 0) {
    warnings.push("No remaining payroll periods in the projection window.");
  }

  const personalAllowance = roundToCents(
    input.personalAllowanceOverride != null &&
      Number.isFinite(input.personalAllowanceOverride)
      ? Math.max(0, input.personalAllowanceOverride)
      : input.config.personalAllowanceAnnual,
  );

  const td1Other = Math.max(0, input.td1OtherApprovedAnnual ?? 0);
  // projectedAnnual already includes previous + current + remaining buckets —
  // do not add previousEmployer.otherQualifying again.
  const otherQualifyingAnnual = roundToCents(
    projectedAnnual.otherQualifyingContribution + td1Other,
  );

  const nisPortionOverride = input.formulaOverrides?.nisDeductiblePortion;
  const nisDeductiblePortion =
    nisPortionOverride != null && Number.isFinite(nisPortionOverride)
      ? Math.max(0, Math.min(1, nisPortionOverride))
      : input.config.nisDeductiblePortion;
  if (
    nisPortionOverride != null &&
    Number.isFinite(nisPortionOverride) &&
    nisDeductiblePortion !== input.config.nisDeductiblePortion
  ) {
    warnings.push(
      `NIS deductible portion overridden (${input.config.nisDeductiblePortion} → ${nisDeductiblePortion}).`,
    );
  }

  const capOverride = input.formulaOverrides?.approvedDeductionCapAnnual;
  const approvedDeductionCapAnnual =
    capOverride != null && Number.isFinite(capOverride)
      ? Math.max(0, capOverride)
      : input.config.approvedDeductionCapAnnual;
  if (
    capOverride != null &&
    Number.isFinite(capOverride) &&
    approvedDeductionCapAnnual !== input.config.approvedDeductionCapAnnual
  ) {
    warnings.push(
      `Approved deduction cap overridden (${input.config.approvedDeductionCapAnnual.toFixed(2)} → ${approvedDeductionCapAnnual.toFixed(2)}).`,
    );
  }

  const qualifying = computeQualifyingDeductionBreakdown({
    employeeNisAnnual: projectedAnnual.employeeNis,
    nisDeductiblePortion,
    pensionContributionAnnual: projectedAnnual.pensionContribution,
    otherQualifyingContributionAnnual: otherQualifyingAnnual,
    approvedDeductionCapAnnual,
  });

  if (qualifying.capped) {
    warnings.push(
      `Qualifying deductions capped at ${qualifying.annualCap.toFixed(2)} (gross ${qualifying.grossQualifyingAmount.toFixed(2)}).`,
    );
  }

  const projectedChargeableIncome = roundToCents(
    Math.max(
      0,
      projectedAnnual.taxableEarnings -
        personalAllowance -
        qualifying.allowableQualifyingDeduction,
    ),
  );

  const taxByBand = taxBandsBreakdown(
    projectedChargeableIncome,
    input.config,
  );
  const projectedAnnualTaxLiability = computeTaxOnChargeableIncome(
    projectedChargeableIncome,
    input.config.brackets,
  );

  const previousEmployerPaye = roundToCents(previousEmployer.paye);
  const currentEmployerPaye = roundToCents(currentEmployerActual.paye);
  const manualTaxAdjustment = roundToCents(input.manualTaxAdjustment ?? 0);

  const remainingTaxLiability = roundToCents(
    projectedAnnualTaxLiability -
      previousEmployerPaye -
      currentEmployerPaye +
      manualTaxAdjustment,
  );

  if (remainingTaxLiability < 0) {
    warnings.push(
      "Tax already paid exceeds projected annual liability (over-withheld).",
    );
  }

  let recommendedPayePerPeriod: number | null = null;
  if (periods.remainingPeriods > 0) {
    recommendedPayePerPeriod = roundToCents(
      Math.max(0, remainingTaxLiability) / periods.remainingPeriods,
    );
  } else if (remainingTaxLiability > 0) {
    warnings.push(
      "Remaining tax liability exists but there are no remaining payroll periods.",
    );
  }

  if (recommendedPayePerPeriod != null && recommendedPayePerPeriod < 0) {
    warnings.push("Recommended PAYE per period is negative.");
  }

  return {
    taxYear: input.taxYear,
    calculationDate: new Date().toISOString(),
    periods,
    previousEmployer,
    currentEmployerActual,
    projectedRemaining,
    projectedAnnual,
    personalAllowance,
    qualifying,
    projectedChargeableIncome,
    taxByBand,
    projectedAnnualTaxLiability,
    previousEmployerPaye,
    currentEmployerPaye,
    manualTaxAdjustment,
    remainingTaxLiability,
    recommendedPayePerPeriod,
    warnings,
    previousEmployerExcludedUnverified,
  };
}
