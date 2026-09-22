-- CreateEnum
CREATE TYPE "hr"."OnboardingCaseType" AS ENUM ('NEW_HIRE', 'REHIRE', 'CONTRACTOR', 'CONTINUING');

-- CreateEnum
CREATE TYPE "hr"."OffboardingCaseReason" AS ENUM ('RESIGNATION', 'RETIREMENT', 'END_OF_CONTRACT', 'TERMINATION', 'REDUNDANCY', 'TRANSFER', 'OTHER');

-- AlterTable EmployeeOnboardingCase
ALTER TABLE "hr"."employee_onboarding_cases"
  ADD COLUMN "caseNumber" TEXT,
  ADD COLUMN "caseType" "hr"."OnboardingCaseType" NOT NULL DEFAULT 'NEW_HIRE',
  ADD COLUMN "ownerUserId" TEXT,
  ADD COLUMN "proposedStartDate" DATE,
  ADD COLUMN "confirmedStartDate" DATE,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledReason" TEXT;

-- AlterTable EmployeeOffboardingCase
ALTER TABLE "hr"."employee_offboarding_cases"
  ADD COLUMN "caseNumber" TEXT,
  ADD COLUMN "reasonCode" "hr"."OffboardingCaseReason",
  ADD COLUMN "ownerUserId" TEXT,
  ADD COLUMN "lastWorkingDate" DATE,
  ADD COLUMN "separationDate" DATE,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employee_onboarding_cases_organizationId_caseNumber_key" ON "hr"."employee_onboarding_cases"("organizationId", "caseNumber");

CREATE INDEX "employee_onboarding_cases_ownerUserId_idx" ON "hr"."employee_onboarding_cases"("ownerUserId");

CREATE UNIQUE INDEX "employee_offboarding_cases_organizationId_caseNumber_key" ON "hr"."employee_offboarding_cases"("organizationId", "caseNumber");

CREATE INDEX "employee_offboarding_cases_ownerUserId_idx" ON "hr"."employee_offboarding_cases"("ownerUserId");

-- AddForeignKey
ALTER TABLE "hr"."employee_onboarding_cases"
  ADD CONSTRAINT "employee_onboarding_cases_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hr"."employee_offboarding_cases"
  ADD CONSTRAINT "employee_offboarding_cases_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
