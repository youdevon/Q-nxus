-- AlterEnum
ALTER TYPE "payroll"."AchPaymentBatchStatus" ADD VALUE IF NOT EXISTS 'INVALIDATED';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "payroll"."AchBankValidationStatus" AS ENUM (
    'GENERATED',
    'UPLOADED_FOR_VALIDATION',
    'VALIDATION_FAILED',
    'BANK_VALIDATED',
    'SUBMITTED',
    'PROCESSED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable AchPaymentBatch
ALTER TABLE "payroll"."ach_payment_batches"
  ADD COLUMN IF NOT EXISTS "exportFormat" TEXT,
  ADD COLUMN IF NOT EXISTS "bankValidationStatus" "payroll"."AchBankValidationStatus",
  ADD COLUMN IF NOT EXISTS "fcbErrorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "fcbErrorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "fcbValidationErrorJson" JSONB,
  ADD COLUMN IF NOT EXISTS "correctedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "replacementBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "isRegenerated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable AchPaymentBatchDetail
ALTER TABLE "payroll"."ach_payment_batch_details"
  ADD COLUMN IF NOT EXISTS "transactionCode" TEXT,
  ADD COLUMN IF NOT EXISTS "traceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "excludedFromExport" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "exclusionReason" TEXT;
