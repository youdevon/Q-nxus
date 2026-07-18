-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "hr"."CorrespondenceCategory" ADD VALUE 'POLICY';
ALTER TYPE "hr"."CorrespondenceCategory" ADD VALUE 'OFFER_LETTER';
ALTER TYPE "hr"."CorrespondenceCategory" ADD VALUE 'EXIT_CLEARANCE';
ALTER TYPE "hr"."CorrespondenceCategory" ADD VALUE 'MEDICAL';
ALTER TYPE "hr"."CorrespondenceCategory" ADD VALUE 'IDENTIFICATION';

-- AlterEnum
ALTER TYPE "hr"."CorrespondenceStatus" ADD VALUE 'SUPERSEDED';

-- AlterTable
ALTER TABLE "hr"."employee_correspondences" ADD COLUMN     "managerVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subType" TEXT,
ADD COLUMN     "supersedesId" TEXT,
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "hr"."correspondence_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "hr"."CorrespondenceCategory" NOT NULL DEFAULT 'GENERAL',
    "defaultTitle" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "employeeVisible" BOOLEAN NOT NULL DEFAULT true,
    "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correspondence_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_credentials" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "employeeVisible" BOOLEAN NOT NULL DEFAULT true,
    "fileName" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_training_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "provider" TEXT,
    "completedAt" DATE NOT NULL,
    "expiryDate" DATE,
    "employeeVisible" BOOLEAN NOT NULL DEFAULT true,
    "fileName" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_training_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "correspondence_templates_organizationId_isActive_idx" ON "hr"."correspondence_templates"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "correspondence_templates_organizationId_name_key" ON "hr"."correspondence_templates"("organizationId", "name");

-- CreateIndex
CREATE INDEX "employee_credentials_organizationId_idx" ON "hr"."employee_credentials"("organizationId");

-- CreateIndex
CREATE INDEX "employee_credentials_employeeId_idx" ON "hr"."employee_credentials"("employeeId");

-- CreateIndex
CREATE INDEX "employee_credentials_expiryDate_idx" ON "hr"."employee_credentials"("expiryDate");

-- CreateIndex
CREATE INDEX "employee_training_records_organizationId_idx" ON "hr"."employee_training_records"("organizationId");

-- CreateIndex
CREATE INDEX "employee_training_records_employeeId_idx" ON "hr"."employee_training_records"("employeeId");

-- CreateIndex
CREATE INDEX "employee_training_records_expiryDate_idx" ON "hr"."employee_training_records"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "employee_correspondences_supersedesId_key" ON "hr"."employee_correspondences"("supersedesId");

-- CreateIndex
CREATE INDEX "employee_correspondences_subType_idx" ON "hr"."employee_correspondences"("subType");

-- CreateIndex
CREATE INDEX "employee_correspondences_retentionUntil_idx" ON "hr"."employee_correspondences"("retentionUntil");

-- CreateIndex
CREATE INDEX "employee_correspondences_templateId_idx" ON "hr"."employee_correspondences"("templateId");

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondences" ADD CONSTRAINT "employee_correspondences_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "hr"."employee_correspondences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondences" ADD CONSTRAINT "employee_correspondences_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "hr"."correspondence_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."correspondence_templates" ADD CONSTRAINT "correspondence_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_credentials" ADD CONSTRAINT "employee_credentials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_credentials" ADD CONSTRAINT "employee_credentials_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_training_records" ADD CONSTRAINT "employee_training_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_training_records" ADD CONSTRAINT "employee_training_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

