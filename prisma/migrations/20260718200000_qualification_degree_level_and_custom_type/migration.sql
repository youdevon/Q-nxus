-- CreateEnum
CREATE TYPE "hr"."QualificationDegreeLevel" AS ENUM ('ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE');

-- AlterEnum
ALTER TYPE "hr"."QualificationDocumentType" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "hr"."employee_qualification_documents"
ADD COLUMN "degreeLevel" "hr"."QualificationDegreeLevel",
ADD COLUMN "customTypeLabel" TEXT;
