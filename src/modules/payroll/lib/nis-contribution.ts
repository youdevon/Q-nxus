/** Trinidad & Tobago NIS earnings-class contribution helpers (client-safe). */

import type { NisContributionCategory } from "@/src/modules/payroll/lib/nis-eligibility";
import { resolveNisEligibility } from "@/src/modules/payroll/lib/nis-eligibility";
import {
  computeNisClassZContribution,
  type NisClassZRateInput,
} from "@/src/modules/payroll/lib/nis-class-z";
import { roundToCents } from "@/src/modules/payroll/lib/money";

/**
 * Legacy average weeks/month (52/12 = 13/3). Prefer Mondays-in-period for
 * actual period amounts; keep for illustrative 4⅓ averages in settings UIs.
 */
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
  /** Contribution weeks used (Mondays in period for live calc). */
  weeksInPeriod: number;
  /** True when monthly earnings are below the Class I floor. */
  belowMinimum: boolean;
  /** Normal, Class Z (employer injury only), or exempt. */
  category: NisContributionCategory;
  /** Employer Class Z amount for the period (when category is CLASS_Z). */
  classZEmployerMonthly: number;
  classZEmployerWeekly: number;
  /** System-calculated Class Z before any period override. */
  classZCalculatedEmployerMonthly: number;
  classZOverrideApplied: boolean;
  eligibilityReason: string;
  transitionAlert: string | null;
};

function weeklyToPeriodAmount(weeklyAmount: number, weeksInPeriod: number): number {
  return roundToCents(weeklyAmount * weeksInPeriod);
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
  /**
   * Mondays in the pay period (T&T). Required for period amounts; when omitted,
   * falls back to the legacy 13/3 average for settings illustrations only.
   */
  weeksInPeriod?: number;
  /** @deprecated Prefer `weeksInPeriod`. */
  weeksPerMonth?: number;
}): NisContributionResult {
  const weeksInPeriod = Math.max(
    0,
    input.weeksInPeriod ?? input.weeksPerMonth ?? NIS_WEEKS_PER_MONTH,
  );
  const earningsClass = resolveNisClass(input.monthlySalary, input.classes);

  if (!earningsClass) {
    return {
      classCode: null,
      employeeWeekly: 0,
      employerWeekly: 0,
      employeeMonthly: 0,
      employerMonthly: 0,
      totalMonthly: 0,
      weeksInPeriod,
      belowMinimum: true,
      category: "NORMAL",
      classZEmployerMonthly: 0,
      classZEmployerWeekly: 0,
      classZCalculatedEmployerMonthly: 0,
      classZOverrideApplied: false,
      eligibilityReason: "Earnings below Class I floor",
      transitionAlert: null,
    };
  }

  const employeeMonthly = weeklyToPeriodAmount(
    earningsClass.employeeWeeklyAmount,
    weeksInPeriod,
  );
  const employerMonthly = weeklyToPeriodAmount(
    earningsClass.employerWeeklyAmount,
    weeksInPeriod,
  );

  return {
    classCode: earningsClass.classCode,
    employeeWeekly: earningsClass.employeeWeeklyAmount,
    employerWeekly: earningsClass.employerWeeklyAmount,
    employeeMonthly,
    employerMonthly,
    totalMonthly: roundToCents(employeeMonthly + employerMonthly),
    weeksInPeriod,
    belowMinimum: false,
    category: "NORMAL",
    classZEmployerMonthly: 0,
    classZEmployerWeekly: 0,
    classZCalculatedEmployerMonthly: 0,
    classZOverrideApplied: false,
    eligibilityReason: "Normal NIS earnings class",
    transitionAlert: null,
  };
}

/** Age-aware NIS calculation — normal classes, Class Z, or exempt. */
export function computeEmployeeNisStatutory(input: {
  monthlySalary: number;
  classes: NisEarningsClassInput[];
  classZRates: NisClassZRateInput[];
  weeksInPeriod?: number;
  weeksPerMonth?: number;
  dateOfBirth?: Date | string | null;
  asOf: Date;
  exemptFromNis?: boolean;
  receivingNisRetirementBenefit?: boolean;
  categoryOverride?: NisContributionCategory | null;
  overrideEffectiveFrom?: Date | string | null;
  overrideEffectiveTo?: Date | string | null;
  eligibilityConfig?: {
    fullRetirementAge: number;
    earlyRetirementAge: number;
  };
  classZOverrideAmount?: number | null;
}): NisContributionResult {
  const weeksInPeriod = Math.max(
    0,
    input.weeksInPeriod ?? input.weeksPerMonth ?? NIS_WEEKS_PER_MONTH,
  );

  const eligibility = resolveNisEligibility({
    dateOfBirth: input.dateOfBirth,
    asOf: input.asOf,
    exemptFromNis: input.exemptFromNis ?? false,
    receivingNisRetirementBenefit: input.receivingNisRetirementBenefit ?? false,
    categoryOverride: input.categoryOverride,
    overrideEffectiveFrom: input.overrideEffectiveFrom,
    overrideEffectiveTo: input.overrideEffectiveTo,
    eligibilityConfig: input.eligibilityConfig,
  });

  if (eligibility.category === "EXEMPT") {
    return {
      classCode: null,
      employeeWeekly: 0,
      employerWeekly: 0,
      employeeMonthly: 0,
      employerMonthly: 0,
      totalMonthly: 0,
      weeksInPeriod,
      belowMinimum: false,
      category: "EXEMPT",
      classZEmployerMonthly: 0,
      classZEmployerWeekly: 0,
      classZCalculatedEmployerMonthly: 0,
      classZOverrideApplied: false,
      eligibilityReason: eligibility.reason,
      transitionAlert: eligibility.transitionAlert,
    };
  }

  if (eligibility.category === "CLASS_Z") {
    const classZ = computeNisClassZContribution({
      monthlySalary: input.monthlySalary,
      rates: input.classZRates,
      weeksInPeriod,
    });
    const calculated = classZ.employerMonthly;
    const override =
      input.classZOverrideAmount != null &&
      Number.isFinite(input.classZOverrideAmount)
        ? roundToCents(Math.max(0, input.classZOverrideAmount))
        : null;
    const applied = override ?? calculated;

    return {
      classCode: "Z",
      employeeWeekly: 0,
      employerWeekly: 0,
      employeeMonthly: 0,
      employerMonthly: 0,
      totalMonthly: applied,
      weeksInPeriod,
      belowMinimum: classZ.belowMinimum,
      category: "CLASS_Z",
      classZEmployerMonthly: applied,
      classZEmployerWeekly: classZ.employerWeekly,
      classZCalculatedEmployerMonthly: calculated,
      classZOverrideApplied: override != null && override !== calculated,
      eligibilityReason: eligibility.reason,
      transitionAlert: eligibility.transitionAlert,
    };
  }

  const normal = computeNisContribution({
    monthlySalary: input.monthlySalary,
    classes: input.classes,
    weeksInPeriod,
  });

  return {
    ...normal,
    eligibilityReason: eligibility.reason,
    transitionAlert: eligibility.transitionAlert,
  };
}
