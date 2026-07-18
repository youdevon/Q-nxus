-- Allowances are not taxable by default; opt in via checkbox / category setting.
ALTER TABLE "hr"."allowance_categories" ALTER COLUMN "isTaxableDefault" SET DEFAULT false;

UPDATE "hr"."allowance_categories" SET "isTaxableDefault" = false;
