-- Replace bank percentage splits with fixed amounts + primary remainder

ALTER TABLE "payroll"."payroll_bank_accounts"
  ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2);

ALTER TABLE "payroll"."payroll_bank_accounts"
  DROP COLUMN IF EXISTS "percentage";
