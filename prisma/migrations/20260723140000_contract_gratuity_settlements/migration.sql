-- Contract gratuity policies, settlements, and payroll line codes (TT MoF/IRD).

CREATE TYPE "payroll"."GratuityFormulaKind" AS ENUM (
  'PCT_OF_TERM_EARNINGS',
  'PCT_OF_FINAL_MONTHLY_YEARS',
  'DAYS_PER_YEAR',
  'FLAT_AMOUNT',
  'MANUAL'
);

CREATE TYPE "payroll"."GratuityTaxMode" AS ENUM (
  'NONE',
  'FLAT',
  'TIERED'
);

CREATE TYPE "payroll"."GratuityPayTiming" AS ENUM (
  'LAST_CONTRACT_PAY',
  'OFF_CYCLE_AFTER_END'
);

CREATE TYPE "payroll"."GratuitySettlementStatus" AS ENUM (
  'ESTIMATED',
  'CALCULATED',
  'APPROVED',
  'SCHEDULED',
  'PAID',
  'VOID',
  'INELIGIBLE'
);

CREATE TYPE "payroll"."GratuityTaxRemittanceStatus" AS ENUM (
  'NOT_APPLICABLE',
  'PENDING',
  'REMITTED'
);

ALTER TYPE "payroll"."PayrollLineItemCode" ADD VALUE IF NOT EXISTS 'GRATUITY';
ALTER TYPE "payroll"."PayrollLineItemCode" ADD VALUE IF NOT EXISTS 'GRATUITY_TAX';

CREATE TABLE "payroll"."gratuity_policies" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'TT',
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "formulaKind" "payroll"."GratuityFormulaKind" NOT NULL DEFAULT 'PCT_OF_TERM_EARNINGS',
  "defaultRatePercent" DECIMAL(7,4) NOT NULL,
  "taxMode" "payroll"."GratuityTaxMode" NOT NULL DEFAULT 'TIERED',
  "flatTaxRatePercent" DECIMAL(7,4),
  "applyPersonalAllowance" BOOLEAN NOT NULL DEFAULT false,
  "minServiceMonths" INTEGER,
  "daysPerYearOfService" DECIMAL(7,4),
  "daysInYearBasis" INTEGER DEFAULT 26,
  "eligibilityOnFullTermOnly" BOOLEAN NOT NULL DEFAULT false,
  "prorateOnEarlyExit" BOOLEAN NOT NULL DEFAULT true,
  "payTiming" "payroll"."GratuityPayTiming" NOT NULL DEFAULT 'OFF_CYCLE_AFTER_END',
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "versionLabel" TEXT,
  "sourceReference" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "gratuity_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll"."gratuity_tax_bands" (
  "id" TEXT NOT NULL,
  "gratuityPolicyId" TEXT NOT NULL,
  "upToAmount" DECIMAL(14,2),
  "ratePercent" DECIMAL(7,4) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "gratuity_tax_bands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll"."employee_gratuity_settlements" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "policyId" TEXT,
  "status" "payroll"."GratuitySettlementStatus" NOT NULL DEFAULT 'ESTIMATED',
  "currency" TEXT NOT NULL DEFAULT 'TTD',
  "formulaKind" "payroll"."GratuityFormulaKind" NOT NULL DEFAULT 'PCT_OF_TERM_EARNINGS',
  "ratePercent" DECIMAL(7,4) NOT NULL,
  "contractMonths" INTEGER NOT NULL DEFAULT 0,
  "serviceYears" DECIMAL(8,4),
  "monthlyEligibleEarnings" DECIMAL(14,2) NOT NULL,
  "eligibleGrossEarnings" DECIMAL(14,2) NOT NULL,
  "grossAmount" DECIMAL(14,2) NOT NULL,
  "taxAmount" DECIMAL(14,2) NOT NULL,
  "netAmount" DECIMAL(14,2) NOT NULL,
  "accruedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "accrualThroughDate" DATE,
  "estimatedAt" TIMESTAMP(3),
  "calculatedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidedByUserId" TEXT,
  "voidReason" TEXT,
  "payRunId" TEXT,
  "payslipId" TEXT,
  "taxRemittanceStatus" "payroll"."GratuityTaxRemittanceStatus" NOT NULL DEFAULT 'PENDING',
  "taxRemittedAt" TIMESTAMP(3),
  "taxRemittedByUserId" TEXT,
  "taxRemittanceReference" TEXT,
  "notes" TEXT,
  "calculationSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_gratuity_settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gratuity_policies_organizationId_effectiveFrom_key"
  ON "payroll"."gratuity_policies"("organizationId", "effectiveFrom");

CREATE INDEX "gratuity_policies_organizationId_isActive_idx"
  ON "payroll"."gratuity_policies"("organizationId", "isActive");

CREATE INDEX "gratuity_policies_organizationId_countryCode_effectiveFrom_idx"
  ON "payroll"."gratuity_policies"("organizationId", "countryCode", "effectiveFrom");

CREATE INDEX "gratuity_tax_bands_gratuityPolicyId_sortOrder_idx"
  ON "payroll"."gratuity_tax_bands"("gratuityPolicyId", "sortOrder");

CREATE UNIQUE INDEX "employee_gratuity_settlements_contractId_key"
  ON "payroll"."employee_gratuity_settlements"("contractId");

CREATE INDEX "employee_gratuity_settlements_organizationId_status_idx"
  ON "payroll"."employee_gratuity_settlements"("organizationId", "status");

CREATE INDEX "employee_gratuity_settlements_organizationId_employeeId_idx"
  ON "payroll"."employee_gratuity_settlements"("organizationId", "employeeId");

CREATE INDEX "employee_gratuity_settlements_payRunId_idx"
  ON "payroll"."employee_gratuity_settlements"("payRunId");

CREATE INDEX "employee_gratuity_settlements_payslipId_idx"
  ON "payroll"."employee_gratuity_settlements"("payslipId");

CREATE INDEX "employee_gratuity_settlements_organizationId_paidAt_idx"
  ON "payroll"."employee_gratuity_settlements"("organizationId", "paidAt");

CREATE INDEX "employee_gratuity_settlements_taxRemittanceStatus_idx"
  ON "payroll"."employee_gratuity_settlements"("taxRemittanceStatus");

ALTER TABLE "payroll"."gratuity_policies"
  ADD CONSTRAINT "gratuity_policies_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."gratuity_tax_bands"
  ADD CONSTRAINT "gratuity_tax_bands_gratuityPolicyId_fkey"
  FOREIGN KEY ("gratuityPolicyId") REFERENCES "payroll"."gratuity_policies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_gratuity_settlements"
  ADD CONSTRAINT "employee_gratuity_settlements_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_gratuity_settlements"
  ADD CONSTRAINT "employee_gratuity_settlements_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_gratuity_settlements"
  ADD CONSTRAINT "employee_gratuity_settlements_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "hr"."employment_contracts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_gratuity_settlements"
  ADD CONSTRAINT "employee_gratuity_settlements_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "payroll"."gratuity_policies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_gratuity_settlements"
  ADD CONSTRAINT "employee_gratuity_settlements_payRunId_fkey"
  FOREIGN KEY ("payRunId") REFERENCES "payroll"."pay_runs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_gratuity_settlements"
  ADD CONSTRAINT "employee_gratuity_settlements_payslipId_fkey"
  FOREIGN KEY ("payslipId") REFERENCES "payroll"."payslips"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_gratuity_settlements"
  ADD CONSTRAINT "employee_gratuity_settlements_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_gratuity_settlements"
  ADD CONSTRAINT "employee_gratuity_settlements_voidedByUserId_fkey"
  FOREIGN KEY ("voidedByUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_gratuity_settlements"
  ADD CONSTRAINT "employee_gratuity_settlements_taxRemittedByUserId_fkey"
  FOREIGN KEY ("taxRemittedByUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
