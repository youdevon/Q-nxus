-- AlterTable
ALTER TABLE "hr"."allowance_categories" ADD COLUMN     "includedInGratuityDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "hr"."employment_contract_allowances" ADD COLUMN     "includedInGratuity" BOOLEAN NOT NULL DEFAULT false;
