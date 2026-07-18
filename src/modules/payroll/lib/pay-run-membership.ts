/**
 * Draft pay-run membership: included vs manually excluded payslips.
 */

import { sumMoney } from "@/src/modules/payroll/lib/money";

export type PayRunMembershipStatus = "DRAFT" | "EXCLUDED" | "POSTED";

export type PayRunAmountRow = {
  status: PayRunMembershipStatus;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

export function isPayslipIncludedInRun(status: PayRunMembershipStatus): boolean {
  return status !== "EXCLUDED";
}

export function filterIncludedPayRunRows<T extends { status: PayRunMembershipStatus }>(
  rows: T[],
): T[] {
  return rows.filter((row) => isPayslipIncludedInRun(row.status));
}

export function aggregateIncludedPayRunTotals(rows: PayRunAmountRow[]): {
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  excludedCount: number;
} {
  const included = filterIncludedPayRunRows(rows);

  return {
    employeeCount: included.length,
    totalGross: sumMoney(...included.map((row) => row.grossPay)),
    totalDeductions: sumMoney(...included.map((row) => row.totalDeductions)),
    totalNet: sumMoney(...included.map((row) => row.netPay)),
    excludedCount: rows.length - included.length,
  };
}

export function normalizeExclusionReason(raw: string): string | null {
  const reason = raw.trim().replace(/\s+/g, " ");
  if (reason.length === 0) {
    return null;
  }
  return reason.slice(0, 500);
}
