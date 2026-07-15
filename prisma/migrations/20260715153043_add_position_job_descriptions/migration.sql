-- CreateEnum
CREATE TYPE "hr"."JobDescriptionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "hr"."JobCriterionType" AS ENUM ('DUTY', 'RESPONSIBILITY', 'PERFORMANCE_OBJECTIVE', 'KEY_PERFORMANCE_INDICATOR', 'TECHNICAL_COMPETENCY', 'BEHAVIOURAL_COMPETENCY', 'QUALIFICATION', 'EXPERIENCE', 'OTHER');

-- CreateTable
CREATE TABLE "hr"."position_job_descriptions" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "positionPurpose" TEXT,
    "reportsTo" TEXT,
    "supervisoryResponsibility" TEXT,
    "qualifications" TEXT,
    "requiredExperience" TEXT,
    "status" "hr"."JobDescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_job_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."job_description_criteria" (
    "id" TEXT NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "criterionType" "hr"."JobCriterionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "measurement" TEXT,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_description_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "position_job_descriptions_positionId_idx" ON "hr"."position_job_descriptions"("positionId");

-- CreateIndex
CREATE INDEX "position_job_descriptions_status_idx" ON "hr"."position_job_descriptions"("status");

-- CreateIndex
CREATE INDEX "position_job_descriptions_isCurrent_idx" ON "hr"."position_job_descriptions"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "position_job_descriptions_positionId_versionNumber_key" ON "hr"."position_job_descriptions"("positionId", "versionNumber");

-- CreateIndex
CREATE INDEX "job_description_criteria_jobDescriptionId_idx" ON "hr"."job_description_criteria"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "job_description_criteria_criterionType_idx" ON "hr"."job_description_criteria"("criterionType");

-- AddForeignKey
ALTER TABLE "hr"."position_job_descriptions" ADD CONSTRAINT "position_job_descriptions_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "hr"."positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."job_description_criteria" ADD CONSTRAINT "job_description_criteria_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "hr"."position_job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
