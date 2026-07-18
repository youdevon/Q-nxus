-- CreateEnum
CREATE TYPE "hr"."WorkforceCategory" AS ENUM ('EMPLOYEE', 'AGENT', 'BOARD', 'CONTRACTOR');

-- AlterTable
ALTER TABLE "hr"."employees" ADD COLUMN "workforceCategory" "hr"."WorkforceCategory" NOT NULL DEFAULT 'EMPLOYEE';

-- CreateIndex
CREATE INDEX "employees_organizationId_workforceCategory_idx" ON "hr"."employees"("organizationId", "workforceCategory");
