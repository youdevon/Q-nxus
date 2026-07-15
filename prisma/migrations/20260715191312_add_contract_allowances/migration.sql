-- CreateEnum
CREATE TYPE "hr"."AllowanceFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'BIWEEKLY', 'PER_PAY_PERIOD', 'ANNUAL', 'ONE_TIME');

-- CreateTable
CREATE TABLE "hr"."allowance_categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isTaxableDefault" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowance_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employment_contract_allowances" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "frequency" "hr"."AllowanceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_contract_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "allowance_categories_organizationId_isActive_idx" ON "hr"."allowance_categories"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "allowance_categories_organizationId_name_key" ON "hr"."allowance_categories"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "allowance_categories_organizationId_code_key" ON "hr"."allowance_categories"("organizationId", "code");

-- CreateIndex
CREATE INDEX "employment_contract_allowances_contractId_idx" ON "hr"."employment_contract_allowances"("contractId");

-- CreateIndex
CREATE INDEX "employment_contract_allowances_categoryId_idx" ON "hr"."employment_contract_allowances"("categoryId");

-- AddForeignKey
ALTER TABLE "hr"."allowance_categories" ADD CONSTRAINT "allowance_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employment_contract_allowances" ADD CONSTRAINT "employment_contract_allowances_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "hr"."employment_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employment_contract_allowances" ADD CONSTRAINT "employment_contract_allowances_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "hr"."allowance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
