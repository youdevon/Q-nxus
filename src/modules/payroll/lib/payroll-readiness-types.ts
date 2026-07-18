/** Client-safe payroll readiness DTOs (no Prisma / pg). */

export type PayrollReadinessRow = {
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  /** Agent / Board / Contractor when not a full employee; null otherwise. */
  workforceCategoryLabel: string | null;
  departmentName: string | null;
  payFrequency: string | null;
  paymentMethod: string | null;
  hasProfile: boolean;
  isReady: boolean;
  blockingIssues: string[];
  /** Soft warnings that do not block payroll readiness. */
  softWarnings: string[];
};

export type PayrollReadinessData = {
  rows: PayrollReadinessRow[];
  readyCount: number;
  notReadyCount: number;
};
