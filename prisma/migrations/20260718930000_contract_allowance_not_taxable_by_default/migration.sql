-- Contract allowance lines are not taxable by default; opt in via the
-- Taxable checkbox on create / amend / renew. Align existing rows with the
-- category-default flip (prior migration only updated allowance_categories).
ALTER TABLE "hr"."employment_contract_allowances" ALTER COLUMN "isTaxable" SET DEFAULT false;

UPDATE "hr"."employment_contract_allowances" SET "isTaxable" = false;
