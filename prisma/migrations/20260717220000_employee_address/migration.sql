-- AlterTable: optional residential / postal address on Employee
ALTER TABLE "hr"."employees"
ADD COLUMN "address" TEXT;
