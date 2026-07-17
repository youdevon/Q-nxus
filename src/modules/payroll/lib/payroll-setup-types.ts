import type { HealthSurchargeResult } from "@/src/modules/payroll/lib/health-surcharge";
import type { NisContributionResult } from "@/src/modules/payroll/lib/nis-contribution";
import type { PayeContributionResult } from "@/src/modules/payroll/lib/paye-contribution";
import type { PayrollReadinessResult } from "@/src/modules/payroll/lib/payroll-readiness";

/** Client-safe payroll setup DTOs (no Prisma / pg). */

export type PayrollBankAccountRecord = {
  id: string;
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  accountName: string | null;
  amount: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type PayrollPayElement = {
  label: string;
  amount: string;
  currency: string;
  frequency: string;
  source: "CONTRACT_SALARY" | "CONTRACT_ALLOWANCE" | "VARIABLE_EARNING";
  isTaxable: boolean;
};

export type StatutoryPreview = {
  monthlyTaxableEarnings: number;
  nis: NisContributionResult | null;
  paye: PayeContributionResult | null;
  health: HealthSurchargeResult | null;
  /** Phase 1 taxable pay uses base salary only and excludes allowances/OT/bonuses/commissions. */
  notes: string[];
};

export type EmployeePayrollSetup = {
  employee: {
    id: string;
    employeeNumber: string;
    displayName: string;
    employmentStatus: string;
    dateOfBirth: string | null;
  };
  profile: {
    id: string;
    payFrequency: string;
    paymentMethod: "BANK_TRANSFER" | "CHEQUE" | "CASH";
    nisNumber: string | null;
    birNumber: string | null;
    notes: string | null;
    td1OtherApprovedAnnual: string | null;
    pensionOnlyIncome: boolean;
    isPayrollReady: boolean;
    updatedAt: string;
  } | null;
  bankAccounts: PayrollBankAccountRecord[];
  currentContract: {
    id: string;
    jobTitle: string;
    baseSalary: string;
    currency: string;
    startDate: string;
    endDate: string | null;
    terminationDate: string | null;
  } | null;
  payElements: PayrollPayElement[];
  readiness: PayrollReadinessResult;
  statutoryPreview: StatutoryPreview | null;
};
