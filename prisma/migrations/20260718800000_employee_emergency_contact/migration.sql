-- AlterTable: optional emergency contact on Employee
ALTER TABLE "hr"."employees"
ADD COLUMN "emergencyContactName" TEXT,
ADD COLUMN "emergencyContactPhone" TEXT,
ADD COLUMN "emergencyContactRelationship" TEXT;
