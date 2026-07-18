-- CreateEnum
CREATE TYPE "hr"."EmployeeFileChecklistItemType" AS ENUM (
  'ACADEMIC_CERTIFICATES',
  'COPY_OF_ID',
  'BIRTH_CERTIFICATE',
  'MARRIAGE_CERTIFICATE',
  'ASSUMPTION_OF_DUTY'
);

-- CreateTable
CREATE TABLE "hr"."employee_file_checklist_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "itemType" "hr"."EmployeeFileChecklistItemType" NOT NULL,
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "qualificationDocumentId" TEXT,
    "credentialId" TEXT,
    "correspondenceId" TEXT,
    "fileName" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "assumptionOfDutySignedAt" TIMESTAMP(3),
    "assumptionOfDutyConfirmedByUserId" TEXT,
    "employeeVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_file_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_file_checklist_items_organizationId_idx" ON "hr"."employee_file_checklist_items"("organizationId");

-- CreateIndex
CREATE INDEX "employee_file_checklist_items_employeeId_idx" ON "hr"."employee_file_checklist_items"("employeeId");

-- CreateIndex
CREATE INDEX "employee_file_checklist_items_itemType_idx" ON "hr"."employee_file_checklist_items"("itemType");

-- CreateIndex
CREATE INDEX "employee_file_checklist_items_qualificationDocumentId_idx" ON "hr"."employee_file_checklist_items"("qualificationDocumentId");

-- CreateIndex
CREATE INDEX "employee_file_checklist_items_credentialId_idx" ON "hr"."employee_file_checklist_items"("credentialId");

-- CreateIndex
CREATE INDEX "employee_file_checklist_items_correspondenceId_idx" ON "hr"."employee_file_checklist_items"("correspondenceId");

-- CreateIndex
CREATE INDEX "employee_file_checklist_items_assumptionOfDutyConfirmedByU_idx" ON "hr"."employee_file_checklist_items"("assumptionOfDutyConfirmedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_file_checklist_items_employeeId_itemType_key" ON "hr"."employee_file_checklist_items"("employeeId", "itemType");

-- AddForeignKey
ALTER TABLE "hr"."employee_file_checklist_items" ADD CONSTRAINT "employee_file_checklist_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_file_checklist_items" ADD CONSTRAINT "employee_file_checklist_items_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_file_checklist_items" ADD CONSTRAINT "employee_file_checklist_items_qualificationDocumentId_fkey" FOREIGN KEY ("qualificationDocumentId") REFERENCES "hr"."employee_qualification_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_file_checklist_items" ADD CONSTRAINT "employee_file_checklist_items_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "hr"."employee_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_file_checklist_items" ADD CONSTRAINT "employee_file_checklist_items_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "hr"."employee_correspondences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_file_checklist_items" ADD CONSTRAINT "employee_file_checklist_items_assumptionOfDutyConfirmedByU_fkey" FOREIGN KEY ("assumptionOfDutyConfirmedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
