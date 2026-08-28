-- Phases 6–7: earning tax treatment + statutory amount overrides.

CREATE TYPE "payroll"."PayrollTaxTreatment" AS ENUM (
  'TAXABLE_EMPLOYMENT',
  'NON_TAXABLE',
  'NIS_ONLY',
  'PAYE_EXEMPT'
);

CREATE TYPE "payroll"."StatutoryOverrideStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'CANCELLED'
);

ALTER TABLE "payroll"."payroll_component_definitions"
  ADD COLUMN "taxTreatment" "payroll"."PayrollTaxTreatment" NOT NULL DEFAULT 'NON_TAXABLE';

UPDATE "payroll"."payroll_component_definitions"
SET "taxTreatment" = 'TAXABLE_EMPLOYMENT'
WHERE "isTaxable" = true;

CREATE TABLE "payroll"."employee_payroll_statutory_overrides" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "periodEnd" DATE NOT NULL,
  "payeAmount" DECIMAL(14,2),
  "nisEmployeeAmount" DECIMAL(14,2),
  "healthSurchargeAmount" DECIMAL(14,2),
  "reason" TEXT NOT NULL,
  "status" "payroll"."StatutoryOverrideStatus" NOT NULL DEFAULT 'DRAFT',
  "requestedByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_payroll_statutory_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_payroll_statutory_overrides_employeeId_periodEnd_key"
  ON "payroll"."employee_payroll_statutory_overrides"("employeeId", "periodEnd");

CREATE INDEX "employee_payroll_statutory_overrides_organizationId_taxYear_status_idx"
  ON "payroll"."employee_payroll_statutory_overrides"("organizationId", "taxYear", "status");

CREATE INDEX "employee_payroll_statutory_overrides_employeeId_taxYear_idx"
  ON "payroll"."employee_payroll_statutory_overrides"("employeeId", "taxYear");

ALTER TABLE "payroll"."employee_payroll_statutory_overrides"
  ADD CONSTRAINT "employee_payroll_statutory_overrides_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_payroll_statutory_overrides"
  ADD CONSTRAINT "employee_payroll_statutory_overrides_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
