/**
 * Tax-year period PAYE (Trinidad & Tobago calendar year: 1 Jan – 31 Dec).
 *
 * Canonical live withholding model — aligns payslips with the Annual PAYE
 * Projection worksheet:
 *
 *   estimated annual taxable
 *     = prior taxable (when recognized)
 *     + current-employer YTD before this period
 *     + this period taxable
 *     + this period taxable × remaining periods after this one
 *
 *   remaining tax
 *     = annual tax on chargeable
 *     − PAYE already recognized (prior when allowed + current employer before)
 *
 *   period PAYE
 *     = max(0, remaining tax ÷ periods still to collect including this one)
 *
 * Never blind-annualizes monthly × 12 for mid-year joiners.
 * Never produces a negative PAYE refund automatically.
 */

import {
  computeTaxOnChargeableIncome,
  type PayeContributionResult,
  type PayeTaxConfigInput,
} from "@/src/modules/payroll/lib/paye-contribution";
import { roundToCents } from "@/src/modules/payroll/lib/money";
import {
  countEmploymentMonthlyPeriods,
  type PayFrequencyCode,
} from "@/src/modules/payroll/lib/remaining-payroll-periods";

export type PayePositionStatus =
  | "NORMAL"
  | "POSSIBLE_OVERDEDUCTION"
  | "POSSIBLE_UNDERDEDUCTION"
  | "PRIOR_EMPLOYMENT_DATA_REQUIRED"
  | "TD1_REQUIRED"
  | "BIR_REVIEW_REQUIRED";

export type PreviousEmploymentStatusCode =
  | "NO_PREVIOUS_EMPLOYMENT"
  | "PREVIOUS_EMPLOYMENT"
  | "UNKNOWN_PREVIOUS_INCOME";

export type TaxYearPeriodPayeInput = {
  taxYear: number;
  periodStart: Date;
  periodEnd: Date;
  /** Employee hire / employment start with this employer. */
  employmentStartDate: Date | null;
  employmentEndDate?: Date | null;
  payFrequency?: PayFrequencyCode;
  config: PayeTaxConfigInput;
  /** Personal allowance override from TD1 / profile; null = statutory. */
  personalAllowanceOverride?: number | null;
  periodTaxableEarnings: number;
  currentEmployerTaxableYtdBefore: number;
  currentEmployerPayePaidYtdBefore: number;
  /** Verified prior-employer taxable (0 when not recognized). */
  priorTaxableYtd?: number;
  priorPayePaidYtd?: number;
  previousEmploymentStatus?: PreviousEmploymentStatusCode | null;
  /** When true, prior figures may enter the estimate. */
  recognizePriorEmployment?: boolean;
  employeeNisWeekly?: number;
  nisEmployeePaidYtdBefore?: number;
  periodNisEmployee?: number;
  otherApprovedDeductionsAnnual?: number;
  priorOtherApprovedYtd?: number;
  td1Submitted?: boolean;
  birDirectionPresent?: boolean;
};

export type TaxYearPeriodPayeResult = PayeContributionResult & {
  method: "TAX_YEAR_PROJECTION";
  taxYear: number;
  periodsInEmploymentYear: number;
  periodsElapsedIncludingThis: number;
  remainingPeriodsAfterThis: number;
  remainingPeriodsIncludingThis: number;
  ytdTaxableIncomeToDate: number;
  projectedRemainingTaxable: number;
  projectedAnnualTaxable: number;
  payePaidYtdBefore: number;
  remainingTaxLiability: number;
  periodPaye: number;
  payePositionStatus: PayePositionStatus;
  projectedOverDeduction: number;
  nisPaidYtd: number;
  nisDeductibleSource: "ytd_paid" | "weekly_annualized";
  warnings: string[];
  explain: {
    employmentStartUsed: string | null;
    formula: string;
    recognizedPriorTaxable: number;
    recognizedPriorPaye: number;
  };
};

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function utcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

/**
 * Whether live payslip should use tax-year projection instead of blind ×12.
 * Mid-year joiners and cumulative / previous-income methods always use it.
 */
export function shouldUseTaxYearPeriodPaye(input: {
  taxCalculationMethod?: string | null;
  cumulativeCalculationEnabled?: boolean;
  employmentStartDate?: Date | null;
  taxYear: number;
}): boolean {
  if (input.cumulativeCalculationEnabled) {
    return true;
  }
  const method = input.taxCalculationMethod ?? "";
  if (
    method === "STANDARD_CUMULATIVE" ||
    method === "PREVIOUS_INCOME_INCLUDED"
  ) {
    return true;
  }

  const hire = input.employmentStartDate
    ? utcDay(input.employmentStartDate)
    : null;
  if (hire && hire.getUTCFullYear() === input.taxYear) {
    const yearStart = new Date(Date.UTC(input.taxYear, 0, 1));
    if (hire.getTime() > yearStart.getTime()) {
      return true;
    }
  }

  return false;
}

export function computeTaxYearPeriodPaye(
  input: TaxYearPeriodPayeInput,
): TaxYearPeriodPayeResult {
  const warnings: string[] = [];
  const periodTaxable = Math.max(0, input.periodTaxableEarnings);
  const currentTaxableBefore = Math.max(0, input.currentEmployerTaxableYtdBefore);
  const currentPayeBefore = Math.max(0, input.currentEmployerPayePaidYtdBefore);

  const status = input.previousEmploymentStatus ?? null;
  const recognizePrior =
    input.recognizePriorEmployment === true &&
    status !== "UNKNOWN_PREVIOUS_INCOME";

  if (status === "UNKNOWN_PREVIOUS_INCOME") {
    warnings.push(
      "Previous employment status is Unknown — prior income is not assumed to be zero. Review required before relying on this PAYE estimate.",
    );
  }

  if (
    status === "PREVIOUS_EMPLOYMENT" &&
    !recognizePrior &&
    (input.priorTaxableYtd ?? 0) <= 0 &&
    (input.priorPayePaidYtd ?? 0) <= 0
  ) {
    warnings.push(
      "Previous employment indicated but verified prior YTD is missing.",
    );
  }

  const priorTaxable = recognizePrior
    ? Math.max(0, input.priorTaxableYtd ?? 0)
    : 0;
  const priorPaye = recognizePrior ? Math.max(0, input.priorPayePaidYtd ?? 0) : 0;

  const periodCounts = countEmploymentMonthlyPeriods({
    taxYear: input.taxYear,
    employmentStartDate: input.employmentStartDate,
    employmentEndDate: input.employmentEndDate ?? null,
    periodEnd: input.periodEnd,
  });

  const remainingIncludingThis = Math.max(
    1,
    periodCounts.remainingPeriodsIncludingThis,
  );
  const remainingAfterThis = Math.max(0, periodCounts.remainingPeriodsAfterThis);

  // Project remaining months after this period at the current period package.
  const projectedRemainingTaxable = roundToCents(
    periodTaxable * remainingAfterThis,
  );
  const ytdTaxableIncomeToDate = roundToCents(
    priorTaxable + currentTaxableBefore + periodTaxable,
  );
  const projectedAnnualTaxable = roundToCents(
    ytdTaxableIncomeToDate + projectedRemainingTaxable,
  );

  const nisBefore = Math.max(0, input.nisEmployeePaidYtdBefore ?? 0);
  const periodNis = Math.max(0, input.periodNisEmployee ?? 0);
  const nisPaidYtd = roundToCents(nisBefore + periodNis);

  let employeeNisAnnual: number;
  let nisDeductibleSource: "ytd_paid" | "weekly_annualized";

  if (nisPaidYtd > 0 && periodCounts.periodsElapsedIncludingThis > 0) {
    const projectedRemainingNis = periodNis * remainingAfterThis;
    employeeNisAnnual = roundToCents(nisPaidYtd + projectedRemainingNis);
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
      (recognizePrior ? Math.max(0, input.priorOtherApprovedYtd ?? 0) : 0),
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

  const personalAllowance =
    input.personalAllowanceOverride != null &&
    Number.isFinite(input.personalAllowanceOverride)
      ? Math.max(0, input.personalAllowanceOverride)
      : input.config.personalAllowanceAnnual;

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

  const payePaidYtdBefore = roundToCents(priorPaye + currentPayeBefore);
  const remainingTaxLiability = roundToCents(annualTax - payePaidYtdBefore);
  const periodPaye = roundToCents(
    Math.max(0, remainingTaxLiability) / remainingIncludingThis,
  );

  const projectedOverDeduction = roundToCents(
    Math.max(0, payePaidYtdBefore - annualTax),
  );

  let payePositionStatus: PayePositionStatus = "NORMAL";
  if (status === "UNKNOWN_PREVIOUS_INCOME") {
    payePositionStatus = "PRIOR_EMPLOYMENT_DATA_REQUIRED";
  } else if (
    status === "PREVIOUS_EMPLOYMENT" &&
    !recognizePrior
  ) {
    payePositionStatus = "PRIOR_EMPLOYMENT_DATA_REQUIRED";
  } else if (projectedOverDeduction > 0) {
    payePositionStatus = "POSSIBLE_OVERDEDUCTION";
    warnings.push(
      `Estimated annual tax ${annualTax.toFixed(2)} is below PAYE already recognized ${payePaidYtdBefore.toFixed(2)} (projected over-deduction ${projectedOverDeduction.toFixed(2)}). No automatic refund — review / BIR direction if needed.`,
    );
  } else if (
    remainingTaxLiability > 0 &&
    periodPaye > periodTaxable * 0.4
  ) {
    payePositionStatus = "POSSIBLE_UNDERDEDUCTION";
    warnings.push(
      "Period PAYE is catching up a material under-withholding relative to taxable pay — confirm prior YTD and salary history.",
    );
  }

  if (input.td1Submitted === false && otherApprovedDeductions > 0) {
    warnings.push("TD1 deductions applied but TD1 is not marked submitted.");
  }
  if (input.birDirectionPresent) {
    // Direction present is informational; special methods handled elsewhere.
  }

  const hireUsed = periodCounts.employmentStartUsed;

  return {
    method: "TAX_YEAR_PROJECTION",
    taxYear: input.taxYear,
    periodsInEmploymentYear: periodCounts.periodsInEmploymentYear,
    periodsElapsedIncludingThis: periodCounts.periodsElapsedIncludingThis,
    remainingPeriodsAfterThis: remainingAfterThis,
    remainingPeriodsIncludingThis: remainingIncludingThis,
    ytdTaxableIncomeToDate,
    projectedRemainingTaxable,
    projectedAnnualTaxable,
    payePaidYtdBefore,
    remainingTaxLiability,
    periodPaye,
    payePositionStatus,
    projectedOverDeduction,
    nisPaidYtd,
    nisDeductibleSource,
    warnings,
    explain: {
      employmentStartUsed: hireUsed,
      formula:
        "prior(recognized) + current YTD before + this period + (this period × remaining after) → chargeable → annual tax − PAYE paid → ÷ remaining periods including this",
      recognizedPriorTaxable: priorTaxable,
      recognizedPriorPaye: priorPaye,
    },
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
