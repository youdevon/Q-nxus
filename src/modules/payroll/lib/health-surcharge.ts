/** Trinidad & Tobago Health Surcharge calculation helpers (client-safe). */

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

export type HealthSurchargeResult = {
  exempt: boolean;
  exemptionReason: "UNDER_AGE" | "SENIOR" | "PENSION_ONLY" | null;
  weeklyAmount: number;
  annualAmount: number;
  /** Average monthly = weekly × 52 / 12. */
  averageMonthlyAmount: number;
  /** Amount for a specific number of weeks in a pay period. */
  periodAmount: number;
  tier: "HIGHER" | "LOWER" | "EXEMPT";
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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

/**
 * Fixed weekly Health Surcharge by earnings tier, with age / pension exemptions.
 *
 * Higher tier when monthly > monthlyEarningsThreshold OR weekly > weeklyEarningsThreshold.
 * Lower tier when monthly ≤ threshold OR weekly ≤ threshold (whichever basis is provided).
 */
export function computeHealthSurcharge(input: {
  config: HealthSurchargeConfigInput;
  monthlyEarnings?: number | null;
  weeklyEarnings?: number | null;
  dateOfBirth?: Date | string | null;
  ageYears?: number | null;
  pensionOnlyIncome?: boolean;
  weeksInPeriod?: number;
  asOf?: Date;
}): HealthSurchargeResult {
  const weeksInPeriod = input.weeksInPeriod ?? 1;
  const asOf = input.asOf ?? new Date();

  let ageYears = input.ageYears ?? null;

  if (ageYears == null && input.dateOfBirth) {
    ageYears = ageInFullYears(input.dateOfBirth, asOf);
  }

  if (ageYears != null && ageYears < input.config.underAgeExempt) {
    return {
      exempt: true,
      exemptionReason: "UNDER_AGE",
      weeklyAmount: 0,
      annualAmount: 0,
      averageMonthlyAmount: 0,
      periodAmount: 0,
      tier: "EXEMPT",
    };
  }

  if (ageYears != null && ageYears >= input.config.seniorAgeExempt) {
    return {
      exempt: true,
      exemptionReason: "SENIOR",
      weeklyAmount: 0,
      annualAmount: 0,
      averageMonthlyAmount: 0,
      periodAmount: 0,
      tier: "EXEMPT",
    };
  }

  if (input.pensionOnlyIncome) {
    return {
      exempt: true,
      exemptionReason: "PENSION_ONLY",
      weeklyAmount: 0,
      annualAmount: 0,
      averageMonthlyAmount: 0,
      periodAmount: 0,
      tier: "EXEMPT",
    };
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

  const annualAmount = roundMoney(weeklyAmount * 52);
  const averageMonthlyAmount = roundMoney(annualAmount / 12);
  const periodAmount = roundMoney(weeklyAmount * weeksInPeriod);

  return {
    exempt: false,
    exemptionReason: null,
    weeklyAmount,
    annualAmount,
    averageMonthlyAmount,
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
