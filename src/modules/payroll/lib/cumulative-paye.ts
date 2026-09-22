/**
 * Cumulative PAYE for Trinidad & Tobago (Phases 4–5).
 *
 * periodPaye = max(0, taxToDate − payeAlreadyPaidYtd)
 * where taxToDate is the statutory annual tax pro-rated by months elapsed,
 * and annual tax is computed from projected annual taxable income
 * (YTD taxable including this period ÷ months × 12).
 *
 * NIS deductible uses projected annual NIS from YTD NIS paid (Phase 5),
 * falling back to weekly × 52 when no YTD NIS exists yet.
 */

import {
  computeTaxOnChargeableIncome,
  type PayeContributionResult,
  type PayeTaxConfigInput,
} from "@/src/modules/payroll/lib/paye-contribution";
import { roundToCents } from "@/src/modules/payroll/lib/money";

export type CumulativePayeInput = {
  /** Taxable employment earnings this period. */
  periodTaxableEarnings: number;
  /** Current-employer taxable posted earlier this tax year (excludes this period). */
  currentEmployerTaxableYtd: number;
  /** Current-employer PAYE posted earlier this tax year. */
  currentEmployerPayePaidYtd: number;
  /** Prior-employer taxable YTD (Phase 3). */
  priorTaxableYtd?: number;
  /** Prior-employer PAYE paid YTD. */
  priorPayePaidYtd?: number;
  /**
   * Calendar months elapsed in the tax year including this period (1–12).
   * Typically period end month number for monthly payroll.
   */
  monthsElapsed: number;
  config: PayeTaxConfigInput;
  /** Fallback when YTD NIS is zero (new joiner). */
  employeeNisWeekly?: number;
  /** NIS employee paid before this period (prior + current posted). */
  nisEmployeePaidYtdBefore?: number;
  /** This period's employee NIS (monthly). */
  periodNisEmployee?: number;
  /** TD1 other approved deductions (annual entitlement). */
  otherApprovedDeductionsAnnual?: number;
  /** Prior-employer other approved deductions YTD (added into annual other base). */
  priorOtherApprovedYtd?: number;
};

export type CumulativePayeResult = PayeContributionResult & {
  method: "CUMULATIVE";
  monthsElapsed: number;
  ytdTaxableIncome: number;
  projectedAnnualTaxable: number;
  payePaidYtdBefore: number;
  taxToDate: number;
  periodPaye: number;
  nisPaidYtd: number;
  nisDeductibleSource: "ytd_paid" | "weekly_annualized";
};

export function clampMonthsElapsed(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(12, Math.max(1, Math.round(value)));
}

/** Month number 1–12 from a period-end date (UTC calendar). */
export function monthsElapsedFromPeriodEnd(periodEnd: Date | string): number {
  const key =
    typeof periodEnd === "string"
      ? periodEnd.slice(0, 10)
      : periodEnd.toISOString().slice(0, 10);
  const month = Number(key.slice(5, 7));
  return clampMonthsElapsed(month);
}

/**
 * Cumulative PAYE for one period.
 * `monthlyPaye` on the result is the period deduction (same as `periodPaye`)
 * so callers of PayeContributionResult keep working.
 */
export function computeCumulativePayeContribution(
  input: CumulativePayeInput,
): CumulativePayeResult {
  const monthsElapsed = clampMonthsElapsed(input.monthsElapsed);
  const priorTaxable = Math.max(0, input.priorTaxableYtd ?? 0);
  const priorPaye = Math.max(0, input.priorPayePaidYtd ?? 0);
  const currentTaxable = Math.max(0, input.currentEmployerTaxableYtd);
  const currentPaye = Math.max(0, input.currentEmployerPayePaidYtd);
  const periodTaxable = Math.max(0, input.periodTaxableEarnings);

  const ytdTaxableIncome = roundToCents(
    priorTaxable + currentTaxable + periodTaxable,
  );
  const projectedAnnualTaxable = roundToCents(
    (ytdTaxableIncome / monthsElapsed) * 12,
  );

  const nisBefore = Math.max(0, input.nisEmployeePaidYtdBefore ?? 0);
  const periodNis = Math.max(0, input.periodNisEmployee ?? 0);
  const nisPaidYtd = roundToCents(nisBefore + periodNis);

  let employeeNisAnnual: number;
  let nisDeductibleSource: "ytd_paid" | "weekly_annualized";

  if (nisPaidYtd > 0) {
    employeeNisAnnual = roundToCents((nisPaidYtd / monthsElapsed) * 12);
    nisDeductibleSource = "ytd_paid";
  } else {
    const weekly = Math.max(0, input.employeeNisWeekly ?? 0);
    employeeNisAnnual = roundToCents(weekly * 52);
    nisDeductibleSource = "weekly_annualized";
  }

  const nisDeductibleGross = roundToCents(
    employeeNisAnnual * input.config.nisDeductiblePortion,
  );

  const otherApprovedDeductions = roundToCents(
    Math.max(0, input.otherApprovedDeductionsAnnual ?? 0) +
      Math.max(0, input.priorOtherApprovedYtd ?? 0),
  );

  const combinedBeforeCap = roundToCents(
    nisDeductibleGross + otherApprovedDeductions,
  );
  const approvedDeductionsApplied = roundToCents(
    Math.min(combinedBeforeCap, input.config.approvedDeductionCapAnnual),
  );
  const nisDeductible = roundToCents(
    Math.min(nisDeductibleGross, approvedDeductionsApplied),
  );

  const personalAllowance = input.config.personalAllowanceAnnual;
  const chargeableIncome = roundToCents(
    Math.max(
      0,
      projectedAnnualTaxable - personalAllowance - approvedDeductionsApplied,
    ),
  );

  const annualTax = computeTaxOnChargeableIncome(
    chargeableIncome,
    input.config.brackets,
  );
  const taxToDate = roundToCents((annualTax * monthsElapsed) / 12);
  const payePaidYtdBefore = roundToCents(priorPaye + currentPaye);
  const periodPaye = roundToCents(Math.max(0, taxToDate - payePaidYtdBefore));

  return {
    method: "CUMULATIVE",
    monthsElapsed,
    ytdTaxableIncome,
    projectedAnnualTaxable,
    payePaidYtdBefore,
    taxToDate,
    periodPaye,
    nisPaidYtd,
    nisDeductibleSource,
    annualTaxableIncome: projectedAnnualTaxable,
    personalAllowance,
    employeeNisAnnual,
    nisDeductible,
    otherApprovedDeductions,
    approvedDeductionsApplied,
    chargeableIncome,
    annualTax,
    monthlyPaye: periodPaye,
  };
}

/** Whether cumulative PAYE should run for this tax profile resolution. */
export function shouldUseCumulativePaye(input: {
  taxCalculationMethod?: string | null;
  cumulativeCalculationEnabled?: boolean;
}): boolean {
  if (input.cumulativeCalculationEnabled) {
    return true;
  }
  const method = input.taxCalculationMethod ?? "";
  return (
    method === "STANDARD_CUMULATIVE" || method === "PREVIOUS_INCOME_INCLUDED"
  );
}
