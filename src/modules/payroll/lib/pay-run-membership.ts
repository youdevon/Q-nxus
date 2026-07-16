/**
 * Draft pay-run membership: included vs manually excluded payslips.
 */

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
  const totals = included.reduce(
    (acc, row) => {
      acc.totalGross += row.grossPay;
      acc.totalDeductions += row.totalDeductions;
      acc.totalNet += row.netPay;
      return acc;
    },
    { totalGross: 0, totalDeductions: 0, totalNet: 0 },
  );

  return {
    employeeCount: included.length,
    totalGross: Math.round(totals.totalGross * 100) / 100,
    totalDeductions: Math.round(totals.totalDeductions * 100) / 100,
    totalNet: Math.round(totals.totalNet * 100) / 100,
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
