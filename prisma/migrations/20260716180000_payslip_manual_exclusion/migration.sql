-- Manual exclusion of employees from draft pay runs

ALTER TYPE "payroll"."PayslipRecordStatus" ADD VALUE 'EXCLUDED';

ALTER TABLE "payroll"."payslips"
  ADD COLUMN IF NOT EXISTS "excludedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "excludedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "exclusionReason" TEXT;

CREATE INDEX IF NOT EXISTS "payslips_payRunId_status_idx"
  ON "payroll"."payslips"("payRunId", "status");
