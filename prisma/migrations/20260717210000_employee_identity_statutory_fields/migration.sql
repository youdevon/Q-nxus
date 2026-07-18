-- CreateEnum
CREATE TYPE "hr"."EmployeeIdType" AS ENUM ('NATIONAL_ID', 'DRIVERS_PERMIT', 'NON_NATIONAL');

-- AlterTable: identity / statutory fields on Employee (source of truth)
ALTER TABLE "hr"."employees"
ADD COLUMN "nisNumber" TEXT,
ADD COLUMN "birNumber" TEXT,
ADD COLUMN "idType" "hr"."EmployeeIdType",
ADD COLUMN "idNumber" TEXT;

-- Backfill from existing payroll profile copies where employee fields are empty
UPDATE "hr"."employees" AS e
SET
  "nisNumber" = COALESCE(e."nisNumber", p."nisNumber"),
  "birNumber" = COALESCE(e."birNumber", p."birNumber")
FROM "payroll"."payroll_profiles" AS p
WHERE p."employeeId" = e.id
  AND (
    (e."nisNumber" IS NULL AND p."nisNumber" IS NOT NULL)
    OR (e."birNumber" IS NULL AND p."birNumber" IS NOT NULL)
  );
