-- CreateEnum
CREATE TYPE "hr"."CorrespondenceCategory" AS ENUM (
  'RECOMMENDATION',
  'DISCIPLINARY',
  'WARNING',
  'INSTRUCTION',
  'COMMENDATION',
  'PERFORMANCE',
  'GENERAL',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "hr"."CorrespondenceStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'ACKNOWLEDGED',
  'ARCHIVED'
);

-- CreateTable
CREATE TABLE "hr"."employee_correspondences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" "hr"."CorrespondenceCategory" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "effectiveDate" DATE NOT NULL,
    "issueDate" DATE,
    "issuedByUserId" TEXT,
    "status" "hr"."CorrespondenceStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeVisible" BOOLEAN NOT NULL DEFAULT true,
    "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByUserId" TEXT,
    "retentionUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_correspondences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_correspondence_attachments" (
    "id" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_correspondence_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_correspondences_organizationId_idx" ON "hr"."employee_correspondences"("organizationId");

-- CreateIndex
CREATE INDEX "employee_correspondences_employeeId_idx" ON "hr"."employee_correspondences"("employeeId");

-- CreateIndex
CREATE INDEX "employee_correspondences_status_idx" ON "hr"."employee_correspondences"("status");

-- CreateIndex
CREATE INDEX "employee_correspondences_category_idx" ON "hr"."employee_correspondences"("category");

-- CreateIndex
CREATE INDEX "employee_correspondences_issueDate_idx" ON "hr"."employee_correspondences"("issueDate");

-- CreateIndex
CREATE INDEX "employee_correspondences_issuedByUserId_idx" ON "hr"."employee_correspondences"("issuedByUserId");

-- CreateIndex
CREATE INDEX "employee_correspondences_acknowledgedByUserId_idx" ON "hr"."employee_correspondences"("acknowledgedByUserId");

-- CreateIndex
CREATE INDEX "employee_correspondences_employeeId_status_employeeVisible_idx" ON "hr"."employee_correspondences"("employeeId", "status", "employeeVisible");

-- CreateIndex
CREATE INDEX "employee_correspondence_attachments_correspondenceId_idx" ON "hr"."employee_correspondence_attachments"("correspondenceId");

-- CreateIndex
CREATE INDEX "employee_correspondence_attachments_uploadedByUserId_idx" ON "hr"."employee_correspondence_attachments"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondences" ADD CONSTRAINT "employee_correspondences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondences" ADD CONSTRAINT "employee_correspondences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondences" ADD CONSTRAINT "employee_correspondences_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondences" ADD CONSTRAINT "employee_correspondences_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondence_attachments" ADD CONSTRAINT "employee_correspondence_attachments_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "hr"."employee_correspondences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_correspondence_attachments" ADD CONSTRAINT "employee_correspondence_attachments_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
