/** Client-safe payroll readiness DTOs (no Prisma / pg). */

export type PayrollReadinessRow = {
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
  payFrequency: string | null;
  paymentMethod: string | null;
  hasProfile: boolean;
  isReady: boolean;
  blockingIssues: string[];
};

export type PayrollReadinessData = {
  rows: PayrollReadinessRow[];
  readyCount: number;
  notReadyCount: number;
};
