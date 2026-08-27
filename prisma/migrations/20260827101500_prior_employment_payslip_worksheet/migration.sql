-- Payslip worksheet fields for clearer prior-employer YTD entry.

CREATE TYPE "payroll"."PriorTaxableIncomeEntryMode" AS ENUM (
  'DIRECT',
  'WORKSHEET'
);

ALTER TABLE "payroll"."employee_prior_employment_ytds"
  ADD COLUMN "taxableIncomeEntryMode" "payroll"."PriorTaxableIncomeEntryMode" NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN "grossEarningsYtd" DECIMAL(14,2),
  ADD COLUMN "nonTaxableAllowancesYtd" DECIMAL(14,2);
