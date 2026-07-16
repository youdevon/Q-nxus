-- PAYE tax configs/brackets + Health Surcharge + employee DOB + TD1 stubs

ALTER TABLE "hr"."employees"
  ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE;

ALTER TABLE "payroll"."payroll_profiles"
  ADD COLUMN IF NOT EXISTS "td1OtherApprovedAnnual" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "pensionOnlyIncome" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "payroll"."paye_tax_configs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personalAllowanceAnnual" DECIMAL(14,2) NOT NULL,
  "nisDeductiblePortion" DECIMAL(5,4) NOT NULL,
  "approvedDeductionCapAnnual" DECIMAL(14,2) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "versionLabel" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "paye_tax_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "paye_tax_configs_organizationId_effectiveFrom_key"
  ON "payroll"."paye_tax_configs"("organizationId", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "paye_tax_configs_organizationId_isActive_idx"
  ON "payroll"."paye_tax_configs"("organizationId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'paye_tax_configs_organizationId_fkey'
  ) THEN
    ALTER TABLE "payroll"."paye_tax_configs"
      ADD CONSTRAINT "paye_tax_configs_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payroll"."paye_tax_brackets" (
  "id" TEXT NOT NULL,
  "payeTaxConfigId" TEXT NOT NULL,
  "upToAmount" DECIMAL(14,2),
  "ratePercent" DECIMAL(7,4) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "paye_tax_brackets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "paye_tax_brackets_payeTaxConfigId_sortOrder_idx"
  ON "payroll"."paye_tax_brackets"("payeTaxConfigId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'paye_tax_brackets_payeTaxConfigId_fkey'
  ) THEN
    ALTER TABLE "payroll"."paye_tax_brackets"
      ADD CONSTRAINT "paye_tax_brackets_payeTaxConfigId_fkey"
      FOREIGN KEY ("payeTaxConfigId") REFERENCES "payroll"."paye_tax_configs"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payroll"."health_surcharge_configs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "higherWeeklyAmount" DECIMAL(10,2) NOT NULL,
  "lowerWeeklyAmount" DECIMAL(10,2) NOT NULL,
  "weeklyEarningsThreshold" DECIMAL(14,2) NOT NULL,
  "monthlyEarningsThreshold" DECIMAL(14,2) NOT NULL,
  "underAgeExempt" INTEGER NOT NULL DEFAULT 16,
  "seniorAgeExempt" INTEGER NOT NULL DEFAULT 60,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "versionLabel" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "health_surcharge_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "health_surcharge_configs_organizationId_effectiveFrom_key"
  ON "payroll"."health_surcharge_configs"("organizationId", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "health_surcharge_configs_organizationId_isActive_idx"
  ON "payroll"."health_surcharge_configs"("organizationId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'health_surcharge_configs_organizationId_fkey'
  ) THEN
    ALTER TABLE "payroll"."health_surcharge_configs"
      ADD CONSTRAINT "health_surcharge_configs_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Remove legacy flat-percent PAYE statutory rates (replaced by PayeTaxConfig)
DELETE FROM "payroll"."statutory_rates"
WHERE "rateType" = 'PAYE';

-- Seed PAYE config (2026) for every organization
INSERT INTO "payroll"."paye_tax_configs" (
  "id",
  "organizationId",
  "personalAllowanceAnnual",
  "nisDeductiblePortion",
  "approvedDeductionCapAnnual",
  "effectiveFrom",
  "effectiveTo",
  "versionLabel",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o."id" || 'paye-2026-01-01'),
  o."id",
  90000.00,
  0.7000,
  60000.00,
  DATE '2026-01-01',
  NULL,
  '2026',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "core"."organizations" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "payroll"."paye_tax_configs" c
  WHERE c."organizationId" = o."id"
    AND c."effectiveFrom" = DATE '2026-01-01'
);

INSERT INTO "payroll"."paye_tax_brackets" (
  "id",
  "payeTaxConfigId",
  "upToAmount",
  "ratePercent",
  "sortOrder"
)
SELECT
  md5(c."id" || 'bracket-' || b."sortOrder"::text),
  c."id",
  b."upToAmount",
  b."ratePercent",
  b."sortOrder"
FROM "payroll"."paye_tax_configs" c
CROSS JOIN (
  VALUES
    (1000000.00::numeric, 25.0000::numeric, 0),
    (NULL::numeric, 30.0000::numeric, 1)
) AS b("upToAmount", "ratePercent", "sortOrder")
WHERE c."effectiveFrom" = DATE '2026-01-01'
  AND NOT EXISTS (
    SELECT 1
    FROM "payroll"."paye_tax_brackets" x
    WHERE x."payeTaxConfigId" = c."id"
  );

-- Seed Health Surcharge config (2026)
INSERT INTO "payroll"."health_surcharge_configs" (
  "id",
  "organizationId",
  "higherWeeklyAmount",
  "lowerWeeklyAmount",
  "weeklyEarningsThreshold",
  "monthlyEarningsThreshold",
  "underAgeExempt",
  "seniorAgeExempt",
  "effectiveFrom",
  "effectiveTo",
  "versionLabel",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o."id" || 'health-2026-01-01'),
  o."id",
  8.25,
  4.80,
  109.00,
  469.99,
  16,
  60,
  DATE '2026-01-01',
  NULL,
  '2026',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "core"."organizations" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "payroll"."health_surcharge_configs" h
  WHERE h."organizationId" = o."id"
    AND h."effectiveFrom" = DATE '2026-01-01'
);
