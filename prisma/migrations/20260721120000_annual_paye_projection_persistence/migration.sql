-- Annual PAYE projection persistence, tax-year adjustments, earning treatment overrides

CREATE TYPE "payroll"."AnnualPayrollProjectionStatus" AS ENUM (
  'DRAFT',
  'CALCULATED',
  'REVIEW_REQUIRED',
  'APPROVED',
  'SUPERSEDED'
);

CREATE TYPE "payroll"."TaxYearAdjustmentType" AS ENUM (
  'PREVIOUS_INCOME',
  'PREVIOUS_PAYE',
  'PERSONAL_ALLOWANCE',
  'TAXABLE_EARNINGS',
  'NON_TAXABLE_EARNINGS',
  'PAYE',
  'NIS',
  'HEALTH_SURCHARGE',
  'PENSION',
  'QUALIFYING_DEDUCTION',
  'PROJECTED_EARNINGS',
  'REMAINING_PERIOD',
  'TAX_RATE_INSTRUCTION',
  'OTHER_TAX'
);

CREATE TYPE "payroll"."TaxYearAdjustmentStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'REVERSED'
);

CREATE TABLE "payroll"."employee_annual_payroll_projections" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "calculationDate" DATE NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "payroll"."AnnualPayrollProjectionStatus" NOT NULL DEFAULT 'CALCULATED',
  "previousEmployerTaxableIncome" DECIMAL(14,2) NOT NULL,
  "currentEmployerActualTaxableIncome" DECIMAL(14,2) NOT NULL,
  "projectedRemainingTaxableIncome" DECIMAL(14,2) NOT NULL,
  "projectedAnnualTaxableIncome" DECIMAL(14,2) NOT NULL,
  "projectedEmployeeNis" DECIMAL(14,2) NOT NULL,
  "projectedQualifyingNis" DECIMAL(14,2) NOT NULL,
  "projectedPension" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "projectedOtherQualifyingContributions" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "personalAllowance" DECIMAL(14,2) NOT NULL,
  "allowableQualifyingDeduction" DECIMAL(14,2) NOT NULL,
  "projectedChargeableIncome" DECIMAL(14,2) NOT NULL,
  "projectedAnnualTaxLiability" DECIMAL(14,2) NOT NULL,
  "previousEmployerPaye" DECIMAL(14,2) NOT NULL,
  "currentEmployerPaye" DECIMAL(14,2) NOT NULL,
  "manualTaxAdjustment" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "remainingTaxLiability" DECIMAL(14,2) NOT NULL,
  "remainingPayrollPeriods" INTEGER NOT NULL,
  "recommendedPayePerPeriod" DECIMAL(14,2),
  "payFrequency" TEXT NOT NULL,
  "statutoryConfigurationId" TEXT,
  "calculationSnapshot" JSONB,
  "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "generatedByUserId" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "appliedToPeriodEnd" DATE,
  "appliedStatutoryOverrideId" TEXT,
  "supersedesProjectionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_annual_payroll_projections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_annual_payroll_projections_employeeId_taxYear_version_key"
  ON "payroll"."employee_annual_payroll_projections"("employeeId", "taxYear", "version");
CREATE INDEX "employee_annual_payroll_projections_organizationId_taxYear_status_idx"
  ON "payroll"."employee_annual_payroll_projections"("organizationId", "taxYear", "status");
CREATE INDEX "employee_annual_payroll_projections_employeeId_taxYear_status_idx"
  ON "payroll"."employee_annual_payroll_projections"("employeeId", "taxYear", "status");

ALTER TABLE "payroll"."employee_annual_payroll_projections"
  ADD CONSTRAINT "employee_annual_payroll_projections_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll"."employee_annual_payroll_projections"
  ADD CONSTRAINT "employee_annual_payroll_projections_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll"."employee_tax_year_adjustments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "periodEnd" DATE,
  "adjustmentType" "payroll"."TaxYearAdjustmentType" NOT NULL,
  "originalValue" DECIMAL(14,2),
  "adjustmentValue" DECIMAL(14,2) NOT NULL,
  "finalValue" DECIMAL(14,2),
  "reasonCode" TEXT,
  "reason" TEXT NOT NULL,
  "supportingReference" TEXT,
  "status" "payroll"."TaxYearAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "enteredByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_tax_year_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_tax_year_adjustments_organizationId_taxYear_status_idx"
  ON "payroll"."employee_tax_year_adjustments"("organizationId", "taxYear", "status");
CREATE INDEX "employee_tax_year_adjustments_employeeId_taxYear_status_idx"
  ON "payroll"."employee_tax_year_adjustments"("employeeId", "taxYear", "status");

ALTER TABLE "payroll"."employee_tax_year_adjustments"
  ADD CONSTRAINT "employee_tax_year_adjustments_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll"."employee_tax_year_adjustments"
  ADD CONSTRAINT "employee_tax_year_adjustments_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll"."employee_earning_treatment_overrides" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "componentDefinitionId" TEXT NOT NULL,
  "taxTreatment" "payroll"."PayrollTaxTreatment" NOT NULL,
  "includeInProjectedEarnings" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT NOT NULL,
  "supportingReference" TEXT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "status" "payroll"."TaxYearAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
  "enteredByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_earning_treatment_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_earning_treatment_overrides_organizationId_employeeId_idx"
  ON "payroll"."employee_earning_treatment_overrides"("organizationId", "employeeId");
CREATE INDEX "employee_earning_treatment_overrides_employeeId_componentDefinitionId_idx"
  ON "payroll"."employee_earning_treatment_overrides"("employeeId", "componentDefinitionId");
CREATE INDEX "employee_earning_treatment_overrides_componentDefinitionId_idx"
  ON "payroll"."employee_earning_treatment_overrides"("componentDefinitionId");

ALTER TABLE "payroll"."employee_earning_treatment_overrides"
  ADD CONSTRAINT "employee_earning_treatment_overrides_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll"."employee_earning_treatment_overrides"
  ADD CONSTRAINT "employee_earning_treatment_overrides_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll"."employee_earning_treatment_overrides"
  ADD CONSTRAINT "employee_earning_treatment_overrides_componentDefinitionId_fkey"
  FOREIGN KEY ("componentDefinitionId") REFERENCES "payroll"."payroll_component_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
