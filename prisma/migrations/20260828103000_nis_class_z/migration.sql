-- NIS Class Z (employer-only injury coverage) + eligibility config + profile fields

CREATE TYPE "payroll"."NisContributionCategory" AS ENUM ('NORMAL', 'CLASS_Z', 'EXEMPT');

ALTER TABLE "payroll"."payroll_profiles"
  ADD COLUMN IF NOT EXISTS "receivingNisRetirementBenefit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "nisCategoryOverride" "payroll"."NisContributionCategory",
  ADD COLUMN IF NOT EXISTS "nisOverrideReason" TEXT,
  ADD COLUMN IF NOT EXISTS "nisOverrideEffectiveFrom" DATE,
  ADD COLUMN IF NOT EXISTS "nisOverrideEffectiveTo" DATE;

ALTER TABLE "payroll"."employee_payroll_statutory_overrides"
  ADD COLUMN IF NOT EXISTS "nisEmployerAmount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "nisClassZAmount" DECIMAL(14,2);

CREATE TABLE IF NOT EXISTS "payroll"."nis_class_z_rates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "monthlyMin" DECIMAL(14,2) NOT NULL,
  "monthlyMax" DECIMAL(14,2),
  "employerWeeklyAmount" DECIMAL(10,2) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "versionLabel" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "nis_class_z_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "nis_class_z_rates_organizationId_monthlyMin_effectiveFrom_key"
  ON "payroll"."nis_class_z_rates"("organizationId", "monthlyMin", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "nis_class_z_rates_organizationId_effectiveFrom_idx"
  ON "payroll"."nis_class_z_rates"("organizationId", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "nis_class_z_rates_organizationId_isActive_idx"
  ON "payroll"."nis_class_z_rates"("organizationId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nis_class_z_rates_organizationId_fkey'
  ) THEN
    ALTER TABLE "payroll"."nis_class_z_rates"
      ADD CONSTRAINT "nis_class_z_rates_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payroll"."nis_eligibility_configs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fullRetirementAge" INTEGER NOT NULL DEFAULT 65,
  "earlyRetirementAge" INTEGER NOT NULL DEFAULT 60,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "versionLabel" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "nis_eligibility_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "nis_eligibility_configs_organizationId_effectiveFrom_key"
  ON "payroll"."nis_eligibility_configs"("organizationId", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "nis_eligibility_configs_organizationId_isActive_idx"
  ON "payroll"."nis_eligibility_configs"("organizationId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nis_eligibility_configs_organizationId_fkey'
  ) THEN
    ALTER TABLE "payroll"."nis_eligibility_configs"
      ADD CONSTRAINT "nis_eligibility_configs_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed 2026 Class Z schedule (effective 2026-01-05) for every organization
INSERT INTO "payroll"."nis_class_z_rates" (
  "id",
  "organizationId",
  "monthlyMin",
  "monthlyMax",
  "employerWeeklyAmount",
  "effectiveFrom",
  "effectiveTo",
  "versionLabel",
  "notes",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o."id" || 'class-z-' || c."monthlyMin" || '-2026-01-05'),
  o."id",
  c."monthlyMin",
  c."monthlyMax",
  c."employerWeeklyAmount",
  DATE '2026-01-05',
  NULL,
  '2026',
  'Initial Class Z schedule effective 5 January 2026',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "core"."organizations" o
CROSS JOIN (
  VALUES
    (867.00,    1472.99,  2.20),
    (1473.00,   1949.99,  3.20),
    (1950.00,   2642.99,  4.30),
    (2643.00,   3292.99,  5.56),
    (3293.00,   4029.99,  6.84),
    (4030.00,   4852.99,  8.32),
    (4853.00,   5632.99,  9.80),
    (5633.00,   6456.99,  11.30),
    (6457.00,   7409.99,  12.96),
    (7410.00,   8276.99,  14.66),
    (8277.00,   9272.99,  16.42),
    (9273.00,   10312.99, 18.30),
    (10313.00,  11396.99, 20.30),
    (11397.00,  12652.99, 22.49),
    (12653.00,  13599.99, 24.55),
    (13600.00,  NULL,     25.43)
) AS c("monthlyMin", "monthlyMax", "employerWeeklyAmount")
ON CONFLICT DO NOTHING;

-- Default eligibility thresholds per organization
INSERT INTO "payroll"."nis_eligibility_configs" (
  "id",
  "organizationId",
  "fullRetirementAge",
  "earlyRetirementAge",
  "effectiveFrom",
  "effectiveTo",
  "versionLabel",
  "notes",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o."id" || 'nis-eligibility-2026-01-05'),
  o."id",
  65,
  60,
  DATE '2026-01-05',
  NULL,
  '2026',
  'Default T&T NIS Class Z age thresholds',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "core"."organizations" o
ON CONFLICT DO NOTHING;
