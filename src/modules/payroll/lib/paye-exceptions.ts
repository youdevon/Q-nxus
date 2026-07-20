/**
 * Soft PAYE / tax-year exception warnings (Phase 10).
 * These do not block payroll readiness by default; they surface on tax-year
 * and payslip calc notes.
 */

export type PayeExceptionInput = {
  previousEmploymentDeclared: boolean;
  priorEmploymentRecordCount: number;
  priorEmploymentAllVerified: boolean;
  cumulativeEnabled: boolean;
  pendingOverrideCount?: number;
};

export function evaluatePayeExceptions(input: PayeExceptionInput): string[] {
  const warnings: string[] = [];

  if (
    input.previousEmploymentDeclared &&
    input.priorEmploymentRecordCount === 0
  ) {
    warnings.push(
      "Previous employment declared but no prior-employer YTD records on file.",
    );
  }

  if (
    input.cumulativeEnabled &&
    input.priorEmploymentRecordCount > 0 &&
    !input.priorEmploymentAllVerified
  ) {
    warnings.push(
      "Cumulative PAYE is active with unverified prior-employer YTD — verify amounts before posting.",
    );
  }

  if ((input.pendingOverrideCount ?? 0) > 0) {
    warnings.push(
      `${input.pendingOverrideCount} statutory override(s) pending approval.`,
    );
  }

  return warnings;
}
