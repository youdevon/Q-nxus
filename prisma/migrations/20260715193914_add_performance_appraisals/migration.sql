-- CreateEnum
CREATE TYPE "hr"."PerformanceAppraisalStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'SUPERVISOR_REVIEWED', 'EMPLOYEE_ACKNOWLEDGED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "hr"."PerformanceRatingScale" AS ENUM ('ONE_TO_FIVE', 'ONE_TO_TEN', 'PERCENTAGE');

-- CreateTable
CREATE TABLE "hr"."performance_appraisals" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "jobDescriptionId" TEXT,
    "supervisorUserId" TEXT,
    "appraisalNumber" TEXT,
    "title" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "reviewDueDate" TIMESTAMP(3),
    "status" "hr"."PerformanceAppraisalStatus" NOT NULL DEFAULT 'DRAFT',
    "ratingScale" "hr"."PerformanceRatingScale" NOT NULL DEFAULT 'ONE_TO_FIVE',
    "overallScore" DECIMAL(7,2),
    "maximumScore" DECIMAL(7,2) NOT NULL DEFAULT 5,
    "employeeComments" TEXT,
    "supervisorComments" TEXT,
    "developmentPlan" TEXT,
    "employeeAcknowledgedAt" TIMESTAMP(3),
    "supervisorReviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_appraisals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."performance_appraisal_criteria" (
    "id" TEXT NOT NULL,
    "appraisalId" TEXT NOT NULL,
    "sourceCriterionId" TEXT,
    "criterionType" "hr"."JobCriterionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "measurement" TEXT,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "employeeRating" DECIMAL(7,2),
    "supervisorRating" DECIMAL(7,2),
    "finalRating" DECIMAL(7,2),
    "weightedScore" DECIMAL(7,2),
    "employeeComments" TEXT,
    "supervisorComments" TEXT,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_appraisal_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_appraisals_employeeId_idx" ON "hr"."performance_appraisals"("employeeId");

-- CreateIndex
CREATE INDEX "performance_appraisals_assignmentId_idx" ON "hr"."performance_appraisals"("assignmentId");

-- CreateIndex
CREATE INDEX "performance_appraisals_jobDescriptionId_idx" ON "hr"."performance_appraisals"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "performance_appraisals_supervisorUserId_idx" ON "hr"."performance_appraisals"("supervisorUserId");

-- CreateIndex
CREATE INDEX "performance_appraisals_status_idx" ON "hr"."performance_appraisals"("status");

-- CreateIndex
CREATE INDEX "performance_appraisals_periodStart_periodEnd_idx" ON "hr"."performance_appraisals"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "performance_appraisals_reviewDueDate_idx" ON "hr"."performance_appraisals"("reviewDueDate");

-- CreateIndex
CREATE UNIQUE INDEX "performance_appraisals_employeeId_periodStart_periodEnd_key" ON "hr"."performance_appraisals"("employeeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "performance_appraisal_criteria_appraisalId_idx" ON "hr"."performance_appraisal_criteria"("appraisalId");

-- CreateIndex
CREATE INDEX "performance_appraisal_criteria_criterionType_idx" ON "hr"."performance_appraisal_criteria"("criterionType");

-- CreateIndex
CREATE INDEX "performance_appraisal_criteria_sourceCriterionId_idx" ON "hr"."performance_appraisal_criteria"("sourceCriterionId");

-- AddForeignKey
ALTER TABLE "hr"."performance_appraisals" ADD CONSTRAINT "performance_appraisals_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."performance_appraisals" ADD CONSTRAINT "performance_appraisals_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "hr"."employee_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."performance_appraisals" ADD CONSTRAINT "performance_appraisals_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "hr"."position_job_descriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."performance_appraisals" ADD CONSTRAINT "performance_appraisals_supervisorUserId_fkey" FOREIGN KEY ("supervisorUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."performance_appraisal_criteria" ADD CONSTRAINT "performance_appraisal_criteria_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "hr"."performance_appraisals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
