/** Trinidad & Tobago Health Surcharge calculation helpers (client-safe). */

import { roundToCents } from "@/src/modules/payroll/lib/money";

/** Serializable Health Surcharge config passed from server pages into client components. */
export type HealthSurchargeConfigRecord = {
  id: string;
  higherWeeklyAmount: string;
  lowerWeeklyAmount: string;
  weeklyEarningsThreshold: string;
  monthlyEarningsThreshold: string;
  underAgeExempt: number;
  seniorAgeExempt: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  isActive: boolean;
  isCurrent: boolean;
};

export type HealthSurchargeConfigInput = {
  higherWeeklyAmount: number;
  lowerWeeklyAmount: number;
  /** Earnings above this weekly amount use the higher rate. */
  weeklyEarningsThreshold: number;
  /** Earnings above this monthly amount use the higher rate. */
  monthlyEarningsThreshold: number;
  underAgeExempt: number;
  seniorAgeExempt: number;
};

export function toHealthConfigInput(
  record: HealthSurchargeConfigRecord,
): HealthSurchargeConfigInput {
  return {
    higherWeeklyAmount: Number(record.higherWeeklyAmount),
    lowerWeeklyAmount: Number(record.lowerWeeklyAmount),
    weeklyEarningsThreshold: Number(record.weeklyEarningsThreshold),
    monthlyEarningsThreshold: Number(record.monthlyEarningsThreshold),
    underAgeExempt: record.underAgeExempt,
    seniorAgeExempt: record.seniorAgeExempt,
  };
}

export type HealthSurchargeExemptionReason =
  | "UNDER_AGE"
  | "SENIOR"
  | "PENSION_ONLY"
  | "EMPLOYEE_OPT_OUT";

export type HealthSurchargeResult = {
  exempt: boolean;
  exemptionReason: HealthSurchargeExemptionReason | null;
  weeklyAmount: number;
  annualAmount: number;
  /** Legacy reference only: average monthly = weekly x 52 / 12. */
  averageMonthlyAmount: number;
  /** Trinidad contribution weeks in the pay period (Mondays in period). */
  weeksInPeriod: number;
  /** Amount for the contribution weeks in the pay period. */
  periodAmount: number;
  tier: "HIGHER" | "LOWER" | "EXEMPT";
};

export function ageInFullYears(
  dateOfBirth: Date | string,
  asOf: Date = new Date(),
): number {
  const birth =
    typeof dateOfBirth === "string"
      ? new Date(`${dateOfBirth.slice(0, 10)}T00:00:00.000Z`)
      : dateOfBirth;

  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = asOf.getUTCMonth() - birth.getUTCMonth();
  const dayDelta = asOf.getUTCDate() - birth.getUTCDate();

  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  return age;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
}

/**
 * Trinidad-style monthly Health Surcharge contribution weeks.
 *
 * The pay period is charged for each Monday in the calendar period, producing
 * the expected 4-week / 5-week month behavior instead of a 52/12 average.
 */
export function countHealthContributionWeeks(
  periodStart: Date,
  periodEnd: Date,
): number {
  const start = startOfUtcDay(periodStart);
  const end = startOfUtcDay(periodEnd);

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  const firstMonday = new Date(start);
  const daysUntilMonday = (8 - firstMonday.getUTCDay()) % 7;
  firstMonday.setUTCDate(firstMonday.getUTCDate() + daysUntilMonday);

  let weeks = 0;
  for (
    const cursor = firstMonday;
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  ) {
    weeks += 1;
  }

  return weeks;
}

/**
 * Fixed weekly Health Surcharge by earnings tier, with age / pension exemptions.
 *
 * Higher tier when monthly > monthlyEarningsThreshold OR weekly > weeklyEarningsThreshold.
 * Lower tier when monthly ≤ threshold OR weekly ≤ threshold (whichever basis is provided).
 */
function exemptHealthResult(
  reason: HealthSurchargeExemptionReason,
  weeksInPeriod: number,
): HealthSurchargeResult {
  return {
    exempt: true,
    exemptionReason: reason,
    weeklyAmount: 0,
    annualAmount: 0,
    averageMonthlyAmount: 0,
    weeksInPeriod,
    periodAmount: 0,
    tier: "EXEMPT",
  };
}

export function computeHealthSurcharge(input: {
  config: HealthSurchargeConfigInput;
  monthlyEarnings?: number | null;
  weeklyEarnings?: number | null;
  dateOfBirth?: Date | string | null;
  ageYears?: number | null;
  pensionOnlyIncome?: boolean;
  /** Per-employee payroll-profile opt-out. */
  exemptFromHealthSurcharge?: boolean;
  weeksInPeriod?: number;
  asOf?: Date;
}): HealthSurchargeResult {
  const weeksInPeriod = Math.max(0, input.weeksInPeriod ?? 1);
  const asOf = input.asOf ?? new Date();

  if (input.exemptFromHealthSurcharge) {
    return exemptHealthResult("EMPLOYEE_OPT_OUT", weeksInPeriod);
  }

  let ageYears = input.ageYears ?? null;

  if (ageYears == null && input.dateOfBirth) {
    ageYears = ageInFullYears(input.dateOfBirth, asOf);
  }

  if (ageYears != null && ageYears < input.config.underAgeExempt) {
    return exemptHealthResult("UNDER_AGE", weeksInPeriod);
  }

  if (ageYears != null && ageYears >= input.config.seniorAgeExempt) {
    return exemptHealthResult("SENIOR", weeksInPeriod);
  }

  if (input.pensionOnlyIncome) {
    return exemptHealthResult("PENSION_ONLY", weeksInPeriod);
  }

  const monthly = input.monthlyEarnings;
  const weekly = input.weeklyEarnings;

  let useHigher = false;

  if (monthly != null && Number.isFinite(monthly)) {
    useHigher = monthly > input.config.monthlyEarningsThreshold;
  } else if (weekly != null && Number.isFinite(weekly)) {
    useHigher = weekly > input.config.weeklyEarningsThreshold;
  }

  const weeklyAmount = useHigher
    ? input.config.higherWeeklyAmount
    : input.config.lowerWeeklyAmount;

  const annualAmount = roundToCents(weeklyAmount * 52);
  const averageMonthlyAmount = roundToCents(annualAmount / 12);
  const periodAmount = roundToCents(weeklyAmount * weeksInPeriod);

  return {
    exempt: false,
    exemptionReason: null,
    weeklyAmount,
    annualAmount,
    averageMonthlyAmount,
    weeksInPeriod,
    periodAmount,
    tier: useHigher ? "HIGHER" : "LOWER",
  };
}

export const TT_HEALTH_SURCHARGE_2026: HealthSurchargeConfigInput = {
  higherWeeklyAmount: 8.25,
  lowerWeeklyAmount: 4.8,
  weeklyEarningsThreshold: 109,
  monthlyEarningsThreshold: 469.99,
  underAgeExempt: 16,
  seniorAgeExempt: 60,
};
