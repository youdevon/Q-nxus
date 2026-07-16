/** Client-safe payroll salary roster DTOs (no Prisma / pg). */

export type PayrollSalaryRow = {
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
  jobTitle: string | null;
  payFrequency: string | null;
  currency: string | null;
  /** Current contract base salary (monthly). Null when no current contract. */
  baseSalary: number | null;
  /** Current contract allowances, normalised to monthly equivalents. */
  monthlyAllowances: number | null;
  /** Monthly gross pay = base salary + allowances. */
  grossPay: number | null;
  /** Phase 1 taxable pay uses base salary only. */
  monthlyTaxableEarnings: number | null;
  hasCurrentContract: boolean;
  isReady: boolean;
};

export type PayrollSalariesData = {
  rows: PayrollSalaryRow[];
  totalCount: number;
};

export type PayrollSalariesFilters = {
  query?: string;
};
