-- CreateEnum
CREATE TYPE "hr"."EmployeeCorrespondenceResponseStatus" AS ENUM ('OPEN', 'REVIEWED');

-- AlterTable
ALTER TABLE "hr"."employee_correspondences"
ADD COLUMN "allowsEmployeeResponse" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "hr"."correspondence_templates"
ADD COLUMN "allowsEmployeeResponse" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "hr"."employee_correspondence_responses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fileName" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "status" "hr"."EmployeeCorrespondenceResponseStatus" NOT NULL DEFAULT 'OPEN',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_correspondence_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_correspondence_responses_correspondenceId_key" ON "hr"."employee_correspondence_responses"("correspondenceId");

-- CreateIndex
CREATE INDEX "employee_correspondence_responses_organizationId_idx" ON "hr"."employee_correspondence_responses"("organizationId");

-- CreateIndex
CREATE INDEX "employee_correspondence_responses_employeeId_status_idx" ON "hr"."employee_correspondence_responses"("employeeId", "status");

-- CreateIndex
CREATE INDEX "employee_correspondence_responses_reviewedByUserId_idx" ON "hr"."employee_correspondence_responses"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "employee_correspondences_allowsEmployeeResponse_idx" ON "hr"."employee_correspondences"("allowsEmployeeResponse");

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondence_responses" ADD CONSTRAINT "employee_correspondence_responses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondence_responses" ADD CONSTRAINT "employee_correspondence_responses_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "hr"."employee_correspondences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondence_responses" ADD CONSTRAINT "employee_correspondence_responses_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondence_responses" ADD CONSTRAINT "employee_correspondence_responses_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
