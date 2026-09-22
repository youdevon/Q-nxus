/**
 * Qualifying deduction breakdown for annual PAYE projection.
 * Gross = qualifying NIS + pension + annuity + other; allowed = min(gross, annual cap).
 */

import { roundToCents } from "@/src/modules/payroll/lib/money";

export type QualifyingDeductionInput = {
  /** Projected / annual employee NIS contributions. */
  employeeNisAnnual: number;
  /** Fraction of employee NIS that qualifies (e.g. 0.70). */
  nisDeductiblePortion: number;
  pensionContributionAnnual?: number;
  annuityContributionAnnual?: number;
  otherQualifyingContributionAnnual?: number;
  /** Combined annual qualifying-deduction limit (e.g. 60_000). */
  approvedDeductionCapAnnual: number;
};

export type QualifyingDeductionBreakdown = {
  employeeNisAnnual: number;
  nisDeductiblePortion: number;
  qualifyingNisAmount: number;
  pensionContribution: number;
  annuityContribution: number;
  otherQualifyingContribution: number;
  grossQualifyingAmount: number;
  annualCap: number;
  allowableQualifyingDeduction: number;
  capped: boolean;
};

export function computeQualifyingDeductionBreakdown(
  input: QualifyingDeductionInput,
): QualifyingDeductionBreakdown {
  const employeeNisAnnual = Math.max(0, input.employeeNisAnnual);
  const portion = Math.max(0, Math.min(1, input.nisDeductiblePortion));
  const qualifyingNisAmount = roundToCents(employeeNisAnnual * portion);
  const pensionContribution = roundToCents(
    Math.max(0, input.pensionContributionAnnual ?? 0),
  );
  const annuityContribution = roundToCents(
    Math.max(0, input.annuityContributionAnnual ?? 0),
  );
  const otherQualifyingContribution = roundToCents(
    Math.max(0, input.otherQualifyingContributionAnnual ?? 0),
  );
  const grossQualifyingAmount = roundToCents(
    qualifyingNisAmount +
      pensionContribution +
      annuityContribution +
      otherQualifyingContribution,
  );
  const annualCap = Math.max(0, input.approvedDeductionCapAnnual);
  const allowableQualifyingDeduction = roundToCents(
    Math.min(grossQualifyingAmount, annualCap),
  );

  return {
    employeeNisAnnual: roundToCents(employeeNisAnnual),
    nisDeductiblePortion: portion,
    qualifyingNisAmount,
    pensionContribution,
    annuityContribution,
    otherQualifyingContribution,
    grossQualifyingAmount,
    annualCap,
    allowableQualifyingDeduction,
    capped: grossQualifyingAmount > annualCap,
  };
}
