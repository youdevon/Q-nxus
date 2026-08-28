-- Drop unused denormalized readiness flag (live evaluation via evaluatePayrollReadiness).

ALTER TABLE "payroll"."payroll_profiles"
  DROP COLUMN IF EXISTS "isPayrollReady";
