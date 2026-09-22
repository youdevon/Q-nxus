/** Trinidad & Tobago NIS Class Z (employer-only injury coverage) helpers. */

import { NIS_CLASS_I_MONTHLY_MIN } from "@/src/modules/payroll/lib/nis-contribution";
import { roundToCents } from "@/src/modules/payroll/lib/money";

export type NisClassZRateRecord = {
  id: string;
  monthlyMin: string;
  monthlyMax: string | null;
  employerWeeklyAmount: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  isActive: boolean;
  notes: string | null;
};

export type NisClassZRateInput = {
  monthlyMin: number;
  monthlyMax: number | null;
  employerWeeklyAmount: number;
};

export type NisClassZVersionSummary = {
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  isActive: boolean;
  isCurrent: boolean;
  bandCount: number;
};

export type NisClassZContributionResult = {
  employerWeekly: number;
  employerMonthly: number;
  weeksInPeriod: number;
  belowMinimum: boolean;
  bandMin: number | null;
  bandMax: number | null;
};

export function toNisClassZRateInputs(
  records: NisClassZRateRecord[],
): NisClassZRateInput[] {
  return records.map((record) => ({
    monthlyMin: Number(record.monthlyMin),
    monthlyMax:
      record.monthlyMax != null ? Number(record.monthlyMax) : null,
    employerWeeklyAmount: Number(record.employerWeeklyAmount),
  }));
}

function sortRates(rates: NisClassZRateInput[]): NisClassZRateInput[] {
  return [...rates].sort((left, right) => left.monthlyMin - right.monthlyMin);
}

/** Resolve Class Z earnings band for monthly insurable earnings. */
export function resolveNisClassZRate(
  monthlyEarnings: number,
  rates: NisClassZRateInput[],
): NisClassZRateInput | null {
  if (
    !Number.isFinite(monthlyEarnings) ||
    monthlyEarnings < NIS_CLASS_I_MONTHLY_MIN
  ) {
    return null;
  }

  const ordered = sortRates(rates);

  for (const rate of ordered) {
    const withinMin = monthlyEarnings >= rate.monthlyMin;
    const withinMax =
      rate.monthlyMax == null || monthlyEarnings <= rate.monthlyMax;
    if (withinMin && withinMax) {
      return rate;
    }
  }

  return ordered.at(-1) ?? null;
}

export function computeNisClassZContribution(input: {
  monthlySalary: number;
  rates: NisClassZRateInput[];
  weeksInPeriod: number;
}): NisClassZContributionResult {
  const weeksInPeriod = Math.max(0, input.weeksInPeriod);
  const band = resolveNisClassZRate(input.monthlySalary, input.rates);

  if (!band) {
    return {
      employerWeekly: 0,
      employerMonthly: 0,
      weeksInPeriod,
      belowMinimum: true,
      bandMin: null,
      bandMax: null,
    };
  }

  const employerMonthly = roundToCents(
    band.employerWeeklyAmount * weeksInPeriod,
  );

  return {
    employerWeekly: band.employerWeeklyAmount,
    employerMonthly,
    weeksInPeriod,
    belowMinimum: false,
    bandMin: band.monthlyMin,
    bandMax: band.monthlyMax,
  };
}

/** Validate a Class Z rate schedule has contiguous non-overlapping bands. */
export function validateNisClassZRateSchedule(
  rates: NisClassZRateInput[],
): string[] {
  const errors: string[] = [];
  if (rates.length === 0) {
    errors.push("Add at least one earnings band.");
    return errors;
  }

  const ordered = sortRates(rates);
  let expectedMin = NIS_CLASS_I_MONTHLY_MIN;

  for (const [index, rate] of ordered.entries()) {
    if (rate.employerWeeklyAmount < 0) {
      errors.push(`Band ${index + 1}: contribution amount cannot be negative.`);
    }
    if (rate.monthlyMin !== expectedMin && index > 0) {
      errors.push(
        `Band ${index + 1}: lower limit must continue from previous band (expected ${expectedMin.toFixed(2)}).`,
      );
    }
    if (
      rate.monthlyMax != null &&
      rate.monthlyMax < rate.monthlyMin
    ) {
      errors.push(`Band ${index + 1}: upper limit is below lower limit.`);
    }
    expectedMin =
      rate.monthlyMax != null
        ? roundToCents(rate.monthlyMax + 0.01)
        : Number.POSITIVE_INFINITY;
  }

  const last = ordered.at(-1);
  if (last?.monthlyMax != null) {
    errors.push("Highest earnings band must have no upper limit (and above).");
  }

  return errors;
}
