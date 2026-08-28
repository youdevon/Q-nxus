/** NIS contribution category from employee age, retirement benefit, and overrides. */

import { ageInFullYears } from "@/src/modules/payroll/lib/health-surcharge";

export type NisContributionCategory = "NORMAL" | "CLASS_Z" | "EXEMPT";

export type NisEligibilityConfigInput = {
  fullRetirementAge: number;
  earlyRetirementAge: number;
};

export const DEFAULT_NIS_ELIGIBILITY: NisEligibilityConfigInput = {
  fullRetirementAge: 65,
  earlyRetirementAge: 60,
};

export type ResolveNisEligibilityInput = {
  dateOfBirth: Date | string | null | undefined;
  asOf: Date;
  exemptFromNis: boolean;
  receivingNisRetirementBenefit: boolean;
  categoryOverride?: NisContributionCategory | null;
  overrideEffectiveFrom?: Date | string | null;
  overrideEffectiveTo?: Date | string | null;
  eligibilityConfig?: NisEligibilityConfigInput;
};

export type NisEligibilityResult = {
  category: NisContributionCategory;
  age: number | null;
  reason: string;
  /** Shown to payroll when employee newly qualifies for Class Z this period. */
  transitionAlert: string | null;
};

function parseAsOfDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function scheduleCoversAsOf(
  asOf: Date,
  effectiveFrom: Date | string | null | undefined,
  effectiveTo: Date | string | null | undefined,
): boolean {
  if (!effectiveFrom) {
    return true;
  }
  const from = parseAsOfDate(effectiveFrom);
  const asOfKey = asOf.toISOString().slice(0, 10);
  const fromKey = from.toISOString().slice(0, 10);
  if (asOfKey < fromKey) {
    return false;
  }
  if (!effectiveTo) {
    return true;
  }
  const toKey = parseAsOfDate(effectiveTo).toISOString().slice(0, 10);
  return asOfKey <= toKey;
}

function resolveManualOverrideCategory(
  input: ResolveNisEligibilityInput,
): NisContributionCategory | null {
  if (!input.categoryOverride) {
    return null;
  }
  const active = scheduleCoversAsOf(
    input.asOf,
    input.overrideEffectiveFrom,
    input.overrideEffectiveTo,
  );
  return active ? input.categoryOverride : null;
}

/**
 * Determine NIS contribution category for a payroll period.
 * Age is computed from date of birth as at the period end / payment date.
 */
export function resolveNisEligibility(
  input: ResolveNisEligibilityInput,
): NisEligibilityResult {
  const manual = resolveManualOverrideCategory(input);
  if (manual) {
    return {
      category: manual,
      age: input.dateOfBirth
        ? ageInFullYears(input.dateOfBirth, input.asOf)
        : null,
      reason: `Manual NIS category override (${manual})`,
      transitionAlert: null,
    };
  }

  const config = input.eligibilityConfig ?? DEFAULT_NIS_ELIGIBILITY;
  const age =
    input.dateOfBirth != null
      ? ageInFullYears(input.dateOfBirth, input.asOf)
      : null;

  if (age == null) {
    if (input.exemptFromNis) {
      return {
        category: "EXEMPT",
        age: null,
        reason: "NIS not applicable (employee exempt)",
        transitionAlert: null,
      };
    }

    return {
      category: "NORMAL",
      age: null,
      reason: "Date of birth missing — normal NIS rules apply",
      transitionAlert: null,
    };
  }

  if (age >= config.fullRetirementAge) {
    return {
      category: "CLASS_Z",
      age,
      reason: `Age ${age} — Class Z (≥ ${config.fullRetirementAge})`,
      transitionAlert:
        age === config.fullRetirementAge
          ? "Employee has reached the NIS Class Z eligibility age. NIS contribution treatment has been updated."
          : null,
    };
  }

  if (
    age >= config.earlyRetirementAge &&
    age < config.fullRetirementAge &&
    input.receivingNisRetirementBenefit
  ) {
    return {
      category: "CLASS_Z",
      age,
      reason: `Age ${age} with NIS retirement benefit — Class Z`,
      transitionAlert: null,
    };
  }

  if (input.exemptFromNis) {
    return {
      category: "EXEMPT",
      age,
      reason: "NIS not applicable (employee exempt)",
      transitionAlert: null,
    };
  }

  return {
    category: "NORMAL",
    age,
    reason: `Age ${age} — normal NIS earnings class`,
    transitionAlert: null,
  };
}
