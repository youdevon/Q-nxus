-- Phase 2: per-employee, per-tax-year PAYE / TD1 profiles.

CREATE TYPE "payroll"."TaxCalculationMethod" AS ENUM (
  'STANDARD_CUMULATIVE',
  'STANDARD_NON_CUMULATIVE',
  'PREVIOUS_INCOME_INCLUDED',
  'MANUAL_INSTRUCTION',
  'SPECIAL_IRD_INSTRUCTION'
);

CREATE TYPE "payroll"."PersonalAllowanceSource" AS ENUM (
  'STATUTORY_DEFAULT',
  'TD1',
  'IRD_INSTRUCTION',
  'MANUAL_AUTHORIZED'
);

CREATE TYPE "payroll"."EmployeeTaxProfileStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'SUPERSEDED',
  'ARCHIVED'
);

CREATE TABLE "payroll"."employee_tax_profiles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "taxCalculationMethod" "payroll"."TaxCalculationMethod" NOT NULL DEFAULT 'STANDARD_NON_CUMULATIVE',
  "taxProfileStatus" "payroll"."EmployeeTaxProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "personalAllowance" DECIMAL(14,2),
  "personalAllowanceSource" "payroll"."PersonalAllowanceSource" NOT NULL DEFAULT 'STATUTORY_DEFAULT',
  "td1Submitted" BOOLEAN NOT NULL DEFAULT false,
  "td1EffectiveDate" DATE,
  "td1ApprovedByIrd" BOOLEAN NOT NULL DEFAULT false,
  "td1ApprovalReference" TEXT,
  "td1OtherApprovedAnnual" DECIMAL(14,2),
  "td1StoredFileId" TEXT,
  "cumulativeCalculationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "previousEmploymentDeclared" BOOLEAN NOT NULL DEFAULT false,
  "previousEmploymentVerified" BOOLEAN NOT NULL DEFAULT false,
  "previousEmploymentSource" TEXT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_tax_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_tax_profiles_employeeId_taxYear_key"
  ON "payroll"."employee_tax_profiles"("employeeId", "taxYear");

CREATE INDEX "employee_tax_profiles_organizationId_taxYear_idx"
  ON "payroll"."employee_tax_profiles"("organizationId", "taxYear");

CREATE INDEX "employee_tax_profiles_organizationId_taxProfileStatus_idx"
  ON "payroll"."employee_tax_profiles"("organizationId", "taxProfileStatus");

CREATE INDEX "employee_tax_profiles_td1StoredFileId_idx"
  ON "payroll"."employee_tax_profiles"("td1StoredFileId");

ALTER TABLE "payroll"."employee_tax_profiles"
  ADD CONSTRAINT "employee_tax_profiles_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_tax_profiles"
  ADD CONSTRAINT "employee_tax_profiles_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_tax_profiles"
  ADD CONSTRAINT "employee_tax_profiles_td1StoredFileId_fkey"
  FOREIGN KEY ("td1StoredFileId") REFERENCES "hr"."stored_files"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill current-year profiles from existing PayrollProfile TD1 amounts.
INSERT INTO "payroll"."employee_tax_profiles" (
  "id",
  "organizationId",
  "employeeId",
  "taxYear",
  "taxCalculationMethod",
  "taxProfileStatus",
  "personalAllowanceSource",
  "td1OtherApprovedAnnual",
  "effectiveFrom",
  "createdAt",
  "updatedAt"
)
SELECT
  'etp_' || pp."employeeId",
  e."organizationId",
  pp."employeeId",
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  'STANDARD_NON_CUMULATIVE'::"payroll"."TaxCalculationMethod",
  'ACTIVE'::"payroll"."EmployeeTaxProfileStatus",
  'STATUTORY_DEFAULT'::"payroll"."PersonalAllowanceSource",
  pp."td1OtherApprovedAnnual",
  DATE_TRUNC('year', CURRENT_DATE)::DATE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "payroll"."payroll_profiles" pp
INNER JOIN "hr"."employees" e ON e."id" = pp."employeeId"
WHERE pp."td1OtherApprovedAnnual" IS NOT NULL
ON CONFLICT ("employeeId", "taxYear") DO NOTHING;
