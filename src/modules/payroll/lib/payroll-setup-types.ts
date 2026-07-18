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
  /** Percentage of take-home when allocation type is PERCENTAGE. */
  percentage?: string | null;
  isPrimary: boolean;
  sortOrder: number;
  financialInstitutionId?: string | null;
  accountNumberLastFour?: string | null;
};

export type FinancialInstitutionOption = {
  id: string;
  catalogKey: string | null;
  displayName: string;
  shortName: string;
  institutionType: string;
  isActive: boolean;
  isSelectableForEmployees: boolean;
  supportsAchCredits: boolean;
  routingCode: string | null;
  achParticipantCode: string | null;
};

export type PayrollPayElement = {
  label: string;
  amount: string;
  currency: string;
  frequency: string;
  source: "CONTRACT_SALARY" | "CONTRACT_ALLOWANCE" | "VARIABLE_EARNING";
  isTaxable: boolean;
  /** Set for CONTRACT_ALLOWANCE rows; null for base salary / other sources. */
  contractAllowanceId?: string | null;
};

export type StatutoryPreview = {
  monthlyTaxableEarnings: number;
  nis: NisContributionResult | null;
  paye: PayeContributionResult | null;
  health: HealthSurchargeResult | null;
  /** Taxable pay includes base salary plus taxable contract allowances. OT/bonuses deferred. */
  notes: string[];
};

export type EmployeePayrollSetup = {
  employee: {
    id: string;
    employeeNumber: string;
    displayName: string;
    employmentStatus: string;
    dateOfBirth: string | null;
    /** Source-of-truth statutory numbers from the employee record. */
    nisNumber: string | null;
    birNumber: string | null;
  };
  profile: {
    id: string;
    payFrequency: string;
    paymentMethod: "BANK_TRANSFER" | "CHEQUE" | "CASH";
    /** Mirrored copy; prefer employee values via resolveStatutoryNumber. */
    nisNumber: string | null;
    birNumber: string | null;
    notes: string | null;
    td1OtherApprovedAnnual: string | null;
    pensionOnlyIncome: boolean;
    exemptFromNis: boolean;
    exemptFromHealthSurcharge: boolean;
    exemptFromPaye: boolean;
    isPayrollReady: boolean;
    updatedAt: string;
  } | null;
  /** Effective NIS/BIR for form defaults (employee SoT, profile fallback). */
  statutoryNumbers: {
    nisNumber: string | null;
    birNumber: string | null;
    /** True when the value comes from the employee record (or matches it). */
    fromEmployee: boolean;
  };
  bankAccounts: PayrollBankAccountRecord[];
  /** DB-backed institution directory for the bank select (Phase 1). */
  financialInstitutions: FinancialInstitutionOption[];
  bankingFlags: {
    bankingEnabled: boolean;
    splitDepositEnabled: boolean;
    multipleAccountsEnabled: boolean;
    percentageAllocationEnabled: boolean;
    postNetSplitEnabled: boolean;
  };
  currentContract: {
    id: string;
    positionTitle: string;
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
