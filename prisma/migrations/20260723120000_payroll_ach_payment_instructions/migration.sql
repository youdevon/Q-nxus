-- Payroll ACH / payment-instruction hardening (First Citizens worksheet support).
-- Additive only — does not rewrite historical payment snapshots.

-- Enums
CREATE TYPE "payroll"."BankingDataSource" AS ENUM ('MANUAL', 'IMPORT');

ALTER TYPE "payroll"."AchPaymentBatchStatus" ADD VALUE IF NOT EXISTS 'VALIDATION_FAILED';
ALTER TYPE "payroll"."AchPaymentBatchStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_APPROVAL';
ALTER TYPE "payroll"."AchPaymentBatchStatus" ADD VALUE IF NOT EXISTS 'RELEASED';
ALTER TYPE "payroll"."AchPaymentBatchStatus" ADD VALUE IF NOT EXISTS 'RECONCILED';

ALTER TYPE "payroll"."BankExportAdapterKind" ADD VALUE IF NOT EXISTS 'FIRST_CITIZENS_MANUAL_WORKSHEET';
ALTER TYPE "payroll"."BankExportAdapterKind" ADD VALUE IF NOT EXISTS 'FIRST_CITIZENS_IMPORT';

-- Employee bank accounts / payment destinations
ALTER TABLE "payroll"."employee_bank_accounts"
  ADD COLUMN IF NOT EXISTS "routingNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "dataSource" "payroll"."BankingDataSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "changeReason" TEXT,
  ADD COLUMN IF NOT EXISTS "supersedesAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "employee_bank_accounts_employeeId_effectiveFrom_effectiveTo_idx"
  ON "payroll"."employee_bank_accounts"("employeeId", "effectiveFrom", "effectiveTo");

-- ACH payment batches
ALTER TABLE "payroll"."ach_payment_batches"
  ADD COLUMN IF NOT EXISTS "payrollNetTotal" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "effectivePaymentDate" DATE,
  ADD COLUMN IF NOT EXISTS "achType" TEXT,
  ADD COLUMN IF NOT EXISTS "purposeCode" TEXT,
  ADD COLUMN IF NOT EXISTS "entryDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "globalAddenda" TEXT,
  ADD COLUMN IF NOT EXISTS "discretionaryData" TEXT,
  ADD COLUMN IF NOT EXISTS "transactionType" TEXT,
  ADD COLUMN IF NOT EXISTS "validationSummaryJson" JSONB,
  ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "releasedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reconciledByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "supersedesBatchId" TEXT;

-- ACH batch detail frozen First Citizens template fields
ALTER TABLE "payroll"."ach_payment_batch_details"
  ADD COLUMN IF NOT EXISTS "individualId" TEXT,
  ADD COLUMN IF NOT EXISTS "abaNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentType" TEXT,
  ADD COLUMN IF NOT EXISTS "purposeCode" TEXT,
  ADD COLUMN IF NOT EXISTS "addenda" TEXT;
