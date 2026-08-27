-- Tax-year previous-employment status + opening current-employer YTD (migration).

CREATE TYPE "payroll"."PreviousEmploymentStatus" AS ENUM (
  'NO_PREVIOUS_EMPLOYMENT',
  'PREVIOUS_EMPLOYMENT',
  'UNKNOWN_PREVIOUS_INCOME'
);

CREATE TYPE "payroll"."OtherEmolumentIncomeStatus" AS ENUM (
  'NO_OTHER_EMOLUMENTS',
  'HAS_OTHER_EMOLUMENTS',
  'UNKNOWN_OTHER_EMOLUMENTS'
);

ALTER TABLE "payroll"."employee_tax_profiles"
  ADD COLUMN "previousEmploymentStatus" "payroll"."PreviousEmploymentStatus" NOT NULL DEFAULT 'UNKNOWN_PREVIOUS_INCOME',
  ADD COLUMN "otherEmolumentIncomeStatus" "payroll"."OtherEmolumentIncomeStatus" NOT NULL DEFAULT 'UNKNOWN_OTHER_EMOLUMENTS',
  ADD COLUMN "birDirectionPresent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "birDirectionReference" TEXT;

-- Backfill status from existing booleans.
UPDATE "payroll"."employee_tax_profiles"
SET "previousEmploymentStatus" = CASE
  WHEN "previousEmploymentDeclared" = true THEN 'PREVIOUS_EMPLOYMENT'::"payroll"."PreviousEmploymentStatus"
  ELSE 'NO_PREVIOUS_EMPLOYMENT'::"payroll"."PreviousEmploymentStatus"
END;

CREATE TABLE "payroll"."employee_opening_ytd_balances" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "taxProfileId" TEXT,
  "asOfDate" DATE NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "grossPayYtd" DECIMAL(14,2),
  "taxableIncomeYtd" DECIMAL(14,2) NOT NULL,
  "payeDeductedYtd" DECIMAL(14,2) NOT NULL,
  "nisEmployeeYtd" DECIMAL(14,2),
  "nisEmployerYtd" DECIMAL(14,2),
  "healthSurchargeYtd" DECIMAL(14,2),
  "otherApprovedDeductionsYtd" DECIMAL(14,2),
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_opening_ytd_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_opening_ytd_balances_employeeId_taxYear_key"
  ON "payroll"."employee_opening_ytd_balances"("employeeId", "taxYear");

CREATE INDEX "employee_opening_ytd_balances_organizationId_taxYear_idx"
  ON "payroll"."employee_opening_ytd_balances"("organizationId", "taxYear");

CREATE INDEX "employee_opening_ytd_balances_taxProfileId_idx"
  ON "payroll"."employee_opening_ytd_balances"("taxProfileId");

ALTER TABLE "payroll"."employee_opening_ytd_balances"
  ADD CONSTRAINT "employee_opening_ytd_balances_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_opening_ytd_balances"
  ADD CONSTRAINT "employee_opening_ytd_balances_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_opening_ytd_balances"
  ADD CONSTRAINT "employee_opening_ytd_balances_taxProfileId_fkey"
  FOREIGN KEY ("taxProfileId") REFERENCES "payroll"."employee_tax_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
