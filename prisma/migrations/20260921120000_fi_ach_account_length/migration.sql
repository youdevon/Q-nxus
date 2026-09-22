-- Optional ACH account length guidance on financial institutions (export warnings).
ALTER TABLE payroll.financial_institutions
  ADD COLUMN IF NOT EXISTS "accountNumberMinLength" INTEGER,
  ADD COLUMN IF NOT EXISTS "accountNumberMaxLength" INTEGER;
