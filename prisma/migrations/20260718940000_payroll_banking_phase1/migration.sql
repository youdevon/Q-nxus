-- Phase 1 payroll banking: FinancialInstitution directory, EmployeeBankAccount,
-- EmployeePayrollAllocation. PayrollBankAccount retained (deprecated dual-sync).

CREATE TYPE "payroll"."FinancialInstitutionType" AS ENUM (
  'COMMERCIAL_BANK',
  'CREDIT_UNION',
  'BUILDING_SOCIETY',
  'LICENSED_NON_BANK',
  'ELECTRONIC_MONEY',
  'INVESTMENT_MORTGAGE_DEVELOPMENT',
  'CREDIT_UNION_SUPPORT',
  'OTHER'
);

CREATE TYPE "payroll"."BankAccountType" AS ENUM (
  'SAVINGS',
  'CHEQUING',
  'CURRENT',
  'CREDIT_UNION_SHARES',
  'OTHER'
);

CREATE TYPE "payroll"."BankAccountVerificationStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING',
  'VERIFIED',
  'FAILED'
);

CREATE TYPE "payroll"."PayrollAllocationType" AS ENUM (
  'FULL_BALANCE',
  'FIXED_AMOUNT',
  'PERCENTAGE',
  'REMAINDER'
);

CREATE TABLE "payroll"."financial_institutions" (
  "id" TEXT NOT NULL,
  "catalogKey" TEXT,
  "legalName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "institutionType" "payroll"."FinancialInstitutionType" NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'TT',
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "regulator" TEXT,
  "regulatoryReference" TEXT,
  "localInstitutionCode" TEXT,
  "achParticipantCode" TEXT,
  "swiftBic" TEXT,
  "routingCode" TEXT,
  "requiresBranchCode" BOOLEAN NOT NULL DEFAULT false,
  "requiresAccountType" BOOLEAN NOT NULL DEFAULT false,
  "requiresBeneficiaryId" BOOLEAN NOT NULL DEFAULT false,
  "requiresAccountVerification" BOOLEAN NOT NULL DEFAULT false,
  "supportsAchCredits" BOOLEAN NOT NULL DEFAULT false,
  "supportsAchDebits" BOOLEAN NOT NULL DEFAULT false,
  "supportsPayrollDeposits" BOOLEAN NOT NULL DEFAULT true,
  "supportsInternalTransfers" BOOLEAN NOT NULL DEFAULT false,
  "supportsExternalTransfers" BOOLEAN NOT NULL DEFAULT false,
  "supportsSplitDeposits" BOOLEAN NOT NULL DEFAULT true,
  "isSelectableForEmployees" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "financial_institutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_institutions_catalogKey_key"
  ON "payroll"."financial_institutions"("catalogKey");

CREATE INDEX "financial_institutions_countryCode_isActive_idx"
  ON "payroll"."financial_institutions"("countryCode", "isActive");

CREATE INDEX "financial_institutions_isSelectableForEmployees_isActive_idx"
  ON "payroll"."financial_institutions"("isSelectableForEmployees", "isActive");

CREATE INDEX "financial_institutions_institutionType_isActive_idx"
  ON "payroll"."financial_institutions"("institutionType", "isActive");

CREATE TABLE "payroll"."financial_institution_branches" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "branchCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "financial_institution_branches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_institution_branches_institutionId_branchCode_key"
  ON "payroll"."financial_institution_branches"("institutionId", "branchCode");

CREATE INDEX "financial_institution_branches_institutionId_isActive_idx"
  ON "payroll"."financial_institution_branches"("institutionId", "isActive");

ALTER TABLE "payroll"."financial_institution_branches"
  ADD CONSTRAINT "financial_institution_branches_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "payroll"."financial_institutions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll"."employee_bank_accounts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "financialInstitutionId" TEXT,
  "bankName" TEXT NOT NULL,
  "branchCode" TEXT,
  "branchName" TEXT,
  "accountHolderName" TEXT,
  "accountNumber" TEXT NOT NULL,
  "accountNumberLastFour" TEXT NOT NULL,
  "accountType" "payroll"."BankAccountType" NOT NULL DEFAULT 'SAVINGS',
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "nickname" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isPayrollEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "payroll"."BankAccountVerificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "verificationMethod" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "employee_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_bank_accounts_employeeId_isActive_idx"
  ON "payroll"."employee_bank_accounts"("employeeId", "isActive");

CREATE INDEX "employee_bank_accounts_organizationId_employeeId_idx"
  ON "payroll"."employee_bank_accounts"("organizationId", "employeeId");

CREATE INDEX "employee_bank_accounts_financialInstitutionId_idx"
  ON "payroll"."employee_bank_accounts"("financialInstitutionId");

ALTER TABLE "payroll"."employee_bank_accounts"
  ADD CONSTRAINT "employee_bank_accounts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_bank_accounts"
  ADD CONSTRAINT "employee_bank_accounts_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_bank_accounts"
  ADD CONSTRAINT "employee_bank_accounts_financialInstitutionId_fkey"
  FOREIGN KEY ("financialInstitutionId") REFERENCES "payroll"."financial_institutions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payroll"."employee_payroll_allocations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeBankAccountId" TEXT NOT NULL,
  "allocationType" "payroll"."PayrollAllocationType" NOT NULL,
  "percentage" DECIMAL(7,4),
  "fixedAmount" DECIMAL(14,2),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "receivesRemainder" BOOLEAN NOT NULL DEFAULT false,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_payroll_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_payroll_allocations_employeeId_isActive_idx"
  ON "payroll"."employee_payroll_allocations"("employeeId", "isActive");

CREATE INDEX "employee_payroll_allocations_organizationId_employeeId_idx"
  ON "payroll"."employee_payroll_allocations"("organizationId", "employeeId");

CREATE INDEX "employee_payroll_allocations_employeeBankAccountId_idx"
  ON "payroll"."employee_payroll_allocations"("employeeBankAccountId");

ALTER TABLE "payroll"."employee_payroll_allocations"
  ADD CONSTRAINT "employee_payroll_allocations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_payroll_allocations"
  ADD CONSTRAINT "employee_payroll_allocations_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_payroll_allocations"
  ADD CONSTRAINT "employee_payroll_allocations_employeeBankAccountId_fkey"
  FOREIGN KEY ("employeeBankAccountId") REFERENCES "payroll"."employee_bank_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
