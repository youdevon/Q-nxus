-- Phase 3: prior-employer calendar-year YTD + supporting documents.

CREATE TYPE "payroll"."PriorEmploymentDocumentType" AS ENUM (
  'TD4',
  'PRIOR_EMPLOYER_LETTER',
  'PAYSLIP',
  'OTHER'
);

CREATE TYPE "payroll"."PriorEmploymentRecordStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'SUPERSEDED',
  'ARCHIVED'
);

CREATE TABLE "payroll"."employee_prior_employment_ytds" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "taxProfileId" TEXT,
  "employerName" TEXT NOT NULL,
  "employerBirNumber" TEXT,
  "employmentStartDate" DATE,
  "employmentEndDate" DATE,
  "asOfDate" DATE NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "taxableIncomeYtd" DECIMAL(14,2) NOT NULL,
  "payeDeductedYtd" DECIMAL(14,2) NOT NULL,
  "nisEmployeeYtd" DECIMAL(14,2),
  "nisEmployerYtd" DECIMAL(14,2),
  "healthSurchargeYtd" DECIMAL(14,2),
  "otherApprovedDeductionsYtd" DECIMAL(14,2),
  "status" "payroll"."PriorEmploymentRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_prior_employment_ytds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_prior_employment_ytds_employeeId_taxYear_idx"
  ON "payroll"."employee_prior_employment_ytds"("employeeId", "taxYear");

CREATE INDEX "employee_prior_employment_ytds_organizationId_taxYear_idx"
  ON "payroll"."employee_prior_employment_ytds"("organizationId", "taxYear");

CREATE INDEX "employee_prior_employment_ytds_taxProfileId_idx"
  ON "payroll"."employee_prior_employment_ytds"("taxProfileId");

CREATE INDEX "employee_prior_employment_ytds_organizationId_status_idx"
  ON "payroll"."employee_prior_employment_ytds"("organizationId", "status");

ALTER TABLE "payroll"."employee_prior_employment_ytds"
  ADD CONSTRAINT "employee_prior_employment_ytds_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_prior_employment_ytds"
  ADD CONSTRAINT "employee_prior_employment_ytds_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_prior_employment_ytds"
  ADD CONSTRAINT "employee_prior_employment_ytds_taxProfileId_fkey"
  FOREIGN KEY ("taxProfileId") REFERENCES "payroll"."employee_tax_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payroll"."employee_prior_employment_documents" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "priorEmploymentYtdId" TEXT NOT NULL,
  "documentType" "payroll"."PriorEmploymentDocumentType" NOT NULL DEFAULT 'OTHER',
  "label" TEXT,
  "storedFileId" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "employee_prior_employment_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_prior_employment_documents_priorEmploymentYtdId_idx"
  ON "payroll"."employee_prior_employment_documents"("priorEmploymentYtdId");

CREATE INDEX "employee_prior_employment_documents_storedFileId_idx"
  ON "payroll"."employee_prior_employment_documents"("storedFileId");

CREATE INDEX "employee_prior_employment_documents_organizationId_idx"
  ON "payroll"."employee_prior_employment_documents"("organizationId");

ALTER TABLE "payroll"."employee_prior_employment_documents"
  ADD CONSTRAINT "employee_prior_employment_documents_priorEmploymentYtdId_fkey"
  FOREIGN KEY ("priorEmploymentYtdId") REFERENCES "payroll"."employee_prior_employment_ytds"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."employee_prior_employment_documents"
  ADD CONSTRAINT "employee_prior_employment_documents_storedFileId_fkey"
  FOREIGN KEY ("storedFileId") REFERENCES "hr"."stored_files"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
