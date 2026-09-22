/**
 * Payment-readiness / ACH batch validation summary (blocking vs warnings).
 */

import { roundToCents } from "@/src/modules/payroll/lib/money";

export type PaymentReadinessIssue = {
  severity: "blocking" | "warning";
  code: string;
  message: string;
  employeeNumber?: string | null;
};

export type PaymentReadinessSummary = {
  payRunReference: string;
  effectivePaymentDate: string | null;
  employeeCount: number;
  paymentEntryCount: number;
  payrollNetTotal: number;
  achBatchTotal: number;
  difference: number;
  missingBankingCount: number;
  unverifiedCount: number;
  invalidAllocationCount: number;
  invalidBankOrAccountTypeCount: number;
  duplicateEntryCount: number;
  excludedEmployeeCount: number;
  issues: PaymentReadinessIssue[];
  readyForApproval: boolean;
};

export function buildPaymentReadinessSummary(input: {
  payRunReference: string;
  effectivePaymentDate?: string | null;
  employeeCount: number;
  paymentEntryCount: number;
  payrollNetTotal: number;
  achBatchTotal: number;
  missingBankingCount?: number;
  unverifiedCount?: number;
  invalidAllocationCount?: number;
  invalidBankOrAccountTypeCount?: number;
  duplicateEntryCount?: number;
  excludedEmployeeCount?: number;
  issues?: readonly PaymentReadinessIssue[];
}): PaymentReadinessSummary {
  const payrollNetTotal = roundToCents(input.payrollNetTotal);
  const achBatchTotal = roundToCents(input.achBatchTotal);
  const difference = roundToCents(achBatchTotal - payrollNetTotal);
  const issues: PaymentReadinessIssue[] = [...(input.issues ?? [])];

  if (Math.abs(difference) > 0.009) {
    issues.push({
      severity: "blocking",
      code: "TOTAL_MISMATCH",
      message: `ACH batch total ${achBatchTotal.toFixed(2)} differs from payroll net ${payrollNetTotal.toFixed(2)} by ${difference.toFixed(2)}.`,
    });
  }
  if ((input.missingBankingCount ?? 0) > 0) {
    issues.push({
      severity: "blocking",
      code: "MISSING_BANKING",
      message: `${input.missingBankingCount} employee(s) missing banking instructions.`,
    });
  }
  if ((input.unverifiedCount ?? 0) > 0) {
    issues.push({
      severity: "blocking",
      code: "UNVERIFIED",
      message: `${input.unverifiedCount} unverified payment instruction(s).`,
    });
  }
  if ((input.invalidAllocationCount ?? 0) > 0) {
    issues.push({
      severity: "blocking",
      code: "INVALID_ALLOCATION",
      message: `${input.invalidAllocationCount} invalid allocation(s).`,
    });
  }
  if ((input.invalidBankOrAccountTypeCount ?? 0) > 0) {
    issues.push({
      severity: "blocking",
      code: "INVALID_BANK_OR_TYPE",
      message: `${input.invalidBankOrAccountTypeCount} invalid bank or account type(s).`,
    });
  }
  if ((input.duplicateEntryCount ?? 0) > 0) {
    issues.push({
      severity: "blocking",
      code: "DUPLICATE_ENTRIES",
      message: `${input.duplicateEntryCount} duplicate payment entr(y/ies).`,
    });
  }
  if ((input.excludedEmployeeCount ?? 0) > 0) {
    issues.push({
      severity: "warning",
      code: "EXCLUDED_EMPLOYEES",
      message: `${input.excludedEmployeeCount} employee(s) excluded from this batch.`,
    });
  }
  if (input.paymentEntryCount === 0) {
    issues.push({
      severity: "blocking",
      code: "NO_ENTRIES",
      message: "Batch has no payment entries.",
    });
  }

  const readyForApproval = !issues.some((issue) => issue.severity === "blocking");

  return {
    payRunReference: input.payRunReference,
    effectivePaymentDate: input.effectivePaymentDate ?? null,
    employeeCount: input.employeeCount,
    paymentEntryCount: input.paymentEntryCount,
    payrollNetTotal,
    achBatchTotal,
    difference,
    missingBankingCount: input.missingBankingCount ?? 0,
    unverifiedCount: input.unverifiedCount ?? 0,
    invalidAllocationCount: input.invalidAllocationCount ?? 0,
    invalidBankOrAccountTypeCount: input.invalidBankOrAccountTypeCount ?? 0,
    duplicateEntryCount: input.duplicateEntryCount ?? 0,
    excludedEmployeeCount: input.excludedEmployeeCount ?? 0,
    issues,
    readyForApproval,
  };
}
