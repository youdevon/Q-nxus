-- Apply-duration for statutory overrides (this period / year end / contract end).
CREATE TYPE "payroll"."StatutoryOverrideApplyScope" AS ENUM (
  'THIS_PERIOD',
  'THROUGH_YEAR_END',
  'THROUGH_CONTRACT_END'
);

ALTER TABLE "payroll"."employee_payroll_statutory_overrides"
ADD COLUMN "applyScope" "payroll"."StatutoryOverrideApplyScope" NOT NULL DEFAULT 'THIS_PERIOD';
