-- Payroll banking: returns/reconciliation fields + REJECTED/RESOLVED statuses.
-- Account-number encryption is app-level (`v1:` ciphertext in existing columns).

ALTER TYPE "payroll"."PayrollPaymentAllocationStatus" ADD VALUE 'REJECTED';
ALTER TYPE "payroll"."PayrollPaymentAllocationStatus" ADD VALUE 'RESOLVED';

ALTER TABLE "payroll"."payroll_payment_allocations"
  ADD COLUMN "returnedAmount" DECIMAL(14, 2),
  ADD COLUMN "settledAt" TIMESTAMP(3),
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedByUserId" TEXT;
