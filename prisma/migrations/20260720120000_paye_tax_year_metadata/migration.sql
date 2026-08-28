-- Phase 1: tax-year metadata on PAYE schedules (additive; Settings UI unchanged).

ALTER TABLE "payroll"."paye_tax_configs"
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'TT',
  ADD COLUMN IF NOT EXISTS "taxYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  ADD COLUMN IF NOT EXISTS "sourceReference" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

UPDATE "payroll"."paye_tax_configs"
SET "taxYear" = EXTRACT(YEAR FROM "effectiveFrom")::INTEGER
WHERE "taxYear" IS NULL;

CREATE INDEX IF NOT EXISTS "paye_tax_configs_organizationId_taxYear_idx"
  ON "payroll"."paye_tax_configs"("organizationId", "taxYear");

CREATE INDEX IF NOT EXISTS "paye_tax_configs_organizationId_countryCode_effectiveFrom_idx"
  ON "payroll"."paye_tax_configs"("organizationId", "countryCode", "effectiveFrom");
