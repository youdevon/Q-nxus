-- CreateEnum
CREATE TYPE "hr"."QualificationDocumentType" AS ENUM ('CXC', 'CAPE', 'DEGREE', 'DIPLOMA', 'PROFESSIONAL', 'OTHER');

-- CreateTable
CREATE TABLE "hr"."employee_qualification_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" "hr"."QualificationDocumentType" NOT NULL DEFAULT 'OTHER',
    "issuer" TEXT,
    "issueDate" DATE,
    "year" INTEGER,
    "employeeVisible" BOOLEAN NOT NULL DEFAULT true,
    "fileName" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_qualification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_qualification_entries" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "subjectOrName" TEXT NOT NULL,
    "gradeOrResult" TEXT,
    "level" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "employee_qualification_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_qualification_documents_organizationId_idx" ON "hr"."employee_qualification_documents"("organizationId");

-- CreateIndex
CREATE INDEX "employee_qualification_documents_employeeId_idx" ON "hr"."employee_qualification_documents"("employeeId");

-- CreateIndex
CREATE INDEX "employee_qualification_documents_documentType_idx" ON "hr"."employee_qualification_documents"("documentType");

-- CreateIndex
CREATE INDEX "employee_qualification_entries_documentId_sortOrder_idx" ON "hr"."employee_qualification_entries"("documentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "hr"."employee_qualification_documents" ADD CONSTRAINT "employee_qualification_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_qualification_documents" ADD CONSTRAINT "employee_qualification_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_qualification_entries" ADD CONSTRAINT "employee_qualification_entries_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "hr"."employee_qualification_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
