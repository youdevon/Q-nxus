/** Client-safe payroll salary roster DTOs (no Prisma / pg). */

export type PayrollSalaryRow = {
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  /** Workforce / pay-run payee group (EMPLOYEE, BOARD, …). */
  workforceCategory: string;
  workforceCategoryLabel: string | null;
  departmentName: string | null;
  positionTitle: string | null;
  payFrequency: string | null;
  currency: string | null;
  /** Current contract base salary (monthly). Null when no current contract. */
  baseSalary: number | null;
  /** Current contract allowances, normalised to monthly equivalents. */
  monthlyAllowances: number | null;
  /** Monthly gross pay = base salary + allowances. */
  grossPay: number | null;
  /** Taxable pay = base salary + taxable contract allowances (monthly). */
  monthlyTaxableEarnings: number | null;
  hasCurrentContract: boolean;
  isReady: boolean;
};

export type PayrollSalariesGroupCount = {
  value: string;
  label: string;
  count: number;
};

export type PayrollSalariesData = {
  rows: PayrollSalaryRow[];
  totalCount: number;
  /** Counts across the org (unfiltered by search/group) for filter chips. */
  groupCounts: PayrollSalariesGroupCount[];
};

export type PayrollSalariesFilters = {
  query?: string;
  /** Pay-run payee group / workforce category (EMPLOYEE | BOARD | …). */
  payeeGroup?: string;
};
