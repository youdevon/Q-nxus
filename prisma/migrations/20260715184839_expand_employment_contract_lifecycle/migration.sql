/*
  Warnings:

  - Added the required column `contractType` to the `employment_contracts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "hr"."EmploymentContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'SUPERSEDED', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "hr"."EmploymentContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'TEMPORARY', 'PART_TIME', 'INTERNSHIP', 'CONSULTANCY', 'ACTING', 'SECONDMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "hr"."ContractChangeType" AS ENUM ('INITIAL', 'RENEWAL', 'EXTENSION', 'AMENDMENT', 'SALARY_ADJUSTMENT', 'POSITION_CHANGE', 'TERMINATION', 'OTHER');

-- DropForeignKey
ALTER TABLE "hr"."employment_contracts" DROP CONSTRAINT "employment_contracts_employeeId_fkey";

-- AlterTable
ALTER TABLE "hr"."employment_contracts" ADD COLUMN     "changeType" "hr"."ContractChangeType" NOT NULL DEFAULT 'INITIAL',
ADD COLUMN     "contractNumber" TEXT,
ADD COLUMN     "contractType" "hr"."EmploymentContractType" NOT NULL,
ADD COLUMN     "documentReference" TEXT,
ADD COLUMN     "gratuityEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gratuityRate" DECIMAL(5,2),
ADD COLUMN     "gratuityTaxRate" DECIMAL(5,2),
ADD COLUMN     "signedDate" TIMESTAMP(3),
ADD COLUMN     "sourceContractId" TEXT,
ADD COLUMN     "status" "hr"."EmploymentContractStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "terminationDate" TIMESTAMP(3),
ADD COLUMN     "terminationReason" TEXT;

-- CreateIndex
CREATE INDEX "employment_contracts_employeeId_isCurrent_idx" ON "hr"."employment_contracts"("employeeId", "isCurrent");

-- CreateIndex
CREATE INDEX "employment_contracts_status_idx" ON "hr"."employment_contracts"("status");

-- CreateIndex
CREATE INDEX "employment_contracts_endDate_idx" ON "hr"."employment_contracts"("endDate");

-- CreateIndex
CREATE INDEX "employment_contracts_sourceContractId_idx" ON "hr"."employment_contracts"("sourceContractId");

-- AddForeignKey
ALTER TABLE "hr"."employment_contracts" ADD CONSTRAINT "employment_contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employment_contracts" ADD CONSTRAINT "employment_contracts_sourceContractId_fkey" FOREIGN KEY ("sourceContractId") REFERENCES "hr"."employment_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
