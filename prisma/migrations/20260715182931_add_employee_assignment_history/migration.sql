-- CreateEnum
CREATE TYPE "hr"."EmployeeAssignmentType" AS ENUM ('INITIAL_APPOINTMENT', 'TRANSFER', 'PROMOTION', 'DEMOTION', 'ACTING_APPOINTMENT', 'TEMPORARY_ASSIGNMENT', 'SECONDMENT', 'REASSIGNMENT', 'RETURN_TO_SUBSTANTIVE', 'OTHER');

-- CreateTable
CREATE TABLE "hr"."employee_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "positionId" TEXT,
    "jobDescriptionId" TEXT,
    "assignmentType" "hr"."EmployeeAssignmentType" NOT NULL DEFAULT 'INITIAL_APPOINTMENT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "isActing" BOOLEAN NOT NULL DEFAULT false,
    "referenceNumber" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_assignments_employeeId_idx" ON "hr"."employee_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "employee_assignments_departmentId_idx" ON "hr"."employee_assignments"("departmentId");

-- CreateIndex
CREATE INDEX "employee_assignments_positionId_idx" ON "hr"."employee_assignments"("positionId");

-- CreateIndex
CREATE INDEX "employee_assignments_jobDescriptionId_idx" ON "hr"."employee_assignments"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "employee_assignments_employeeId_isCurrent_idx" ON "hr"."employee_assignments"("employeeId", "isCurrent");

-- CreateIndex
CREATE INDEX "employee_assignments_startDate_idx" ON "hr"."employee_assignments"("startDate");

-- AddForeignKey
ALTER TABLE "hr"."employee_assignments" ADD CONSTRAINT "employee_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_assignments" ADD CONSTRAINT "employee_assignments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_assignments" ADD CONSTRAINT "employee_assignments_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "hr"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_assignments" ADD CONSTRAINT "employee_assignments_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "hr"."position_job_descriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
