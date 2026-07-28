import type { HealthSurchargeResult } from "@/src/modules/payroll/lib/health-surcharge";
import type { NisContributionResult } from "@/src/modules/payroll/lib/nis-contribution";
import type { PayeContributionResult } from "@/src/modules/payroll/lib/paye-contribution";
import type { PayrollReadinessResult } from "@/src/modules/payroll/lib/payroll-readiness";
import type {
  EmployeeTaxProfileStatusCode,
  PersonalAllowanceSourceCode,
  TaxCalculationMethodCode,
} from "@/src/modules/payroll/lib/resolve-employee-tax-paye-inputs";

export type EmployeeTaxProfileSetup = {
  id: string | null;
  taxYear: number;
  taxCalculationMethod: TaxCalculationMethodCode;
  taxProfileStatus: EmployeeTaxProfileStatusCode | null;
  personalAllowance: string | null;
  personalAllowanceSource: PersonalAllowanceSourceCode;
  td1Submitted: boolean;
  td1EffectiveDate: string | null;
  td1ApprovedByIrd: boolean;
  td1ApprovalReference: string | null;
  td1OtherApprovedAnnual: string | null;
  cumulativeCalculationEnabled: boolean;
  previousEmploymentDeclared: boolean;
  previousEmploymentVerified: boolean;
  previousEmploymentSource: string | null;
  notes: string | null;
  /** Where resolved TD1 / method came from for calc preview. */
  source: "tax_profile" | "none";
};

export type PriorEmploymentDocumentSetup = {
  id: string;
  documentType: string;
  label: string | null;
  storedFileId: string;
  fileName: string;
  createdAt: string;
};

export type PriorEmploymentYtdSetup = {
  id: string;
  taxYear: number;
  employerName: string;
  employerBirNumber: string | null;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
  asOfDate: string;
  taxableIncomeYtd: string;
  payeDeductedYtd: string;
  nisEmployeeYtd: string | null;
  nisEmployerYtd: string | null;
  healthSurchargeYtd: string | null;
  otherApprovedDeductionsYtd: string | null;
  verified: boolean;
  notes: string | null;
  documents: PriorEmploymentDocumentSetup[];
};

export type PriorEmploymentSetup = {
  taxYear: number;
  records: PriorEmploymentYtdSetup[];
  totals: {
    taxableIncomeYtd: number;
    payeDeductedYtd: number;
    nisEmployeeYtd: number;
    healthSurchargeYtd: number;
    otherApprovedDeductionsYtd: number;
    recordCount: number;
    verifiedCount: number;
    allVerified: boolean;
  };
  /** Verified ACTIVE totals used by cumulative PAYE calc. */
  verifiedTotals: {
    taxableIncomeYtd: number;
    payeDeductedYtd: number;
    nisEmployeeYtd: number;
    healthSurchargeYtd: number;
    otherApprovedDeductionsYtd: number;
    recordCount: number;
    verifiedCount: number;
    allVerified: boolean;
  };
};

/** Client-safe payroll setup DTOs (no Prisma / pg). */

export type PayrollBankAccountRecord = {
  id: string;
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  accountName: string | null;
  /** SAVINGS | CHEQUING for ACH Payment Type (Savings/Checking Credit). */
  accountType?: string | null;
  amount: string | null;
  /** Percentage of take-home when allocation type is PERCENTAGE. */
  percentage?: string | null;
  isPrimary: boolean;
  sortOrder: number;
  financialInstitutionId?: string | null;
  accountNumberLastFour?: string | null;
  verificationStatus?: string | null;
  isVerified?: boolean;
  verifiedAt?: string | null;
  dataSource?: string | null;
  routingNumber?: string | null;
};

export type PayrollBankAccountHistoryRecord = {
  id: string;
  bankName: string;
  accountNumberMasked: string;
  accountType: string | null;
  verificationStatus: string;
  dataSource: string;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  archivedAt: string | null;
  changeReason: string | null;
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
    organizationId: string;
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
    notes: string | null;
    /** Display TD1 from EmployeeTaxProfile (current tax year). */
    td1OtherApprovedAnnual: string | null;
    pensionOnlyIncome: boolean;
    exemptFromNis: boolean;
    exemptFromHealthSurcharge: boolean;
    exemptFromPaye: boolean;
    isPayrollReady: boolean;
    updatedAt: string;
  } | null;
  /** Effective NIS/BIR for form defaults (Employee SoT). */
  statutoryNumbers: {
    nisNumber: string | null;
    birNumber: string | null;
    /** True when the value comes from the employee record. */
    fromEmployee: boolean;
  };
  bankAccounts: PayrollBankAccountRecord[];
  /** Soft-deactivated / superseded instructions (history retained). */
  bankAccountHistory: PayrollBankAccountHistoryRecord[];
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
  /** Per tax-year PAYE / TD1 treatment (Phase 2). */
  taxProfile: EmployeeTaxProfileSetup;
  /** Prior-employer YTD for the current tax year (Phase 3). */
  priorEmployment: PriorEmploymentSetup;
};
