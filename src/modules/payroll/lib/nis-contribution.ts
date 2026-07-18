/** Trinidad & Tobago NIS earnings-class contribution helpers (client-safe). */

import { roundToCents } from "@/src/modules/payroll/lib/money";

export const NIS_WEEKS_PER_MONTH = 13 / 3;

/** Minimum monthly insurable earnings for Class I (below = no NIS contribution). */
export const NIS_CLASS_I_MONTHLY_MIN = 867;

/** Serializable NIS class row passed from server pages into client components. */
export type NisEarningsClassRecord = {
  id: string;
  classCode: string;
  monthlyMin: string;
  monthlyMax: string | null;
  employeeWeeklyAmount: string;
  employerWeeklyAmount: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  isActive: boolean;
};

export type NisClassVersionSummary = {
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  isActive: boolean;
  isCurrent: boolean;
  classCount: number;
};

export type NisEarningsClassInput = {
  classCode: string;
  monthlyMin: number;
  monthlyMax: number | null;
  employeeWeeklyAmount: number;
  employerWeeklyAmount: number;
};

export function toNisClassInputs(
  records: NisEarningsClassRecord[],
): NisEarningsClassInput[] {
  return records.map((record) => ({
    classCode: record.classCode,
    monthlyMin: Number(record.monthlyMin),
    monthlyMax:
      record.monthlyMax != null ? Number(record.monthlyMax) : null,
    employeeWeeklyAmount: Number(record.employeeWeeklyAmount),
    employerWeeklyAmount: Number(record.employerWeeklyAmount),
  }));
}

export type NisContributionResult = {
  classCode: string | null;
  employeeWeekly: number;
  employerWeekly: number;
  employeeMonthly: number;
  employerMonthly: number;
  totalMonthly: number;
  /** True when monthly earnings are below the Class I floor. */
  belowMinimum: boolean;
};

function weeklyToMonthly(weeklyAmount: number, weeksPerMonth: number): number {
  return roundToCents(weeklyAmount * weeksPerMonth);
}

function sortClasses(classes: NisEarningsClassInput[]): NisEarningsClassInput[] {
  return [...classes].sort((left, right) => left.monthlyMin - right.monthlyMin);
}

/**
 * Resolve the NIS earnings class for monthly insurable earnings.
 * Returns null when earnings are below the Class I floor (< TTD 867/month).
 */
export function resolveNisClass(
  monthlyEarnings: number,
  classes: NisEarningsClassInput[],
): NisEarningsClassInput | null {
  if (!Number.isFinite(monthlyEarnings) || monthlyEarnings < NIS_CLASS_I_MONTHLY_MIN) {
    return null;
  }

  const ordered = sortClasses(classes);

  for (const earningsClass of ordered) {
    const withinMin = monthlyEarnings >= earningsClass.monthlyMin;
    const withinMax =
      earningsClass.monthlyMax == null ||
      monthlyEarnings <= earningsClass.monthlyMax;

    if (withinMin && withinMax) {
      return earningsClass;
    }
  }

  // Earnings above all capped bands — use the highest class (typically XVI).
  return ordered.at(-1) ?? null;
}

export function computeNisContribution(input: {
  monthlySalary: number;
  classes: NisEarningsClassInput[];
  weeksPerMonth?: number;
}): NisContributionResult {
  const weeksPerMonth = input.weeksPerMonth ?? NIS_WEEKS_PER_MONTH;
  const earningsClass = resolveNisClass(input.monthlySalary, input.classes);

  if (!earningsClass) {
    return {
      classCode: null,
      employeeWeekly: 0,
      employerWeekly: 0,
      employeeMonthly: 0,
      employerMonthly: 0,
      totalMonthly: 0,
      belowMinimum: true,
    };
  }

  const employeeMonthly = weeklyToMonthly(
    earningsClass.employeeWeeklyAmount,
    weeksPerMonth,
  );
  const employerMonthly = weeklyToMonthly(
    earningsClass.employerWeeklyAmount,
    weeksPerMonth,
  );

  return {
    classCode: earningsClass.classCode,
    employeeWeekly: earningsClass.employeeWeeklyAmount,
    employerWeekly: earningsClass.employerWeeklyAmount,
    employeeMonthly,
    employerMonthly,
    totalMonthly: roundToCents(employeeMonthly + employerMonthly),
    belowMinimum: false,
  };
}
