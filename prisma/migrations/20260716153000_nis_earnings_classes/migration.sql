-- NIS earnings-class tables (Trinidad & Tobago fixed weekly amounts by class)

CREATE TABLE IF NOT EXISTS "payroll"."nis_earnings_classes" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "classCode" TEXT NOT NULL,
  "monthlyMin" DECIMAL(14,2) NOT NULL,
  "monthlyMax" DECIMAL(14,2),
  "employeeWeeklyAmount" DECIMAL(10,2) NOT NULL,
  "employerWeeklyAmount" DECIMAL(10,2) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "versionLabel" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "nis_earnings_classes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "nis_earnings_classes_organizationId_classCode_effectiveFrom_key"
  ON "payroll"."nis_earnings_classes"("organizationId", "classCode", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "nis_earnings_classes_organizationId_effectiveFrom_idx"
  ON "payroll"."nis_earnings_classes"("organizationId", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "nis_earnings_classes_organizationId_isActive_idx"
  ON "payroll"."nis_earnings_classes"("organizationId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nis_earnings_classes_organizationId_fkey'
  ) THEN
    ALTER TABLE "payroll"."nis_earnings_classes"
      ADD CONSTRAINT "nis_earnings_classes_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Remove legacy flat-percent NIS statutory rates (replaced by earnings classes)
DELETE FROM "payroll"."statutory_rates"
WHERE "rateType" IN ('NIS_EMPLOYEE', 'NIS_EMPLOYER');

-- Seed 2026 NIS class schedule (effective 2026-01-05) for every organization
INSERT INTO "payroll"."nis_earnings_classes" (
  "id",
  "organizationId",
  "classCode",
  "monthlyMin",
  "monthlyMax",
  "employeeWeeklyAmount",
  "employerWeeklyAmount",
  "effectiveFrom",
  "effectiveTo",
  "versionLabel",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o."id" || c."classCode" || '2026-01-05'),
  o."id",
  c."classCode",
  c."monthlyMin",
  c."monthlyMax",
  c."employeeWeeklyAmount",
  c."employerWeeklyAmount",
  DATE '2026-01-05',
  NULL,
  '2026',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "core"."organizations" o
CROSS JOIN (
  VALUES
    ('I',   867.00,    1472.99,  14.60,  29.20),
    ('II',  1473.00,   1949.99,  21.30,  42.60),
    ('III', 1950.00,   2642.99,  28.60,  57.20),
    ('IV',  2643.00,   3292.99,  37.00,  74.00),
    ('V',   3293.00,   4029.99,  45.60,  91.20),
    ('VI',  4030.00,   4852.99,  55.40, 110.80),
    ('VII', 4853.00,   5632.99,  65.30, 130.60),
    ('VIII',5633.00,   6456.99,  75.30, 150.60),
    ('IX',  6457.00,   7409.99,  86.40, 172.80),
    ('X',   7410.00,   8276.99,  97.70, 195.40),
    ('XI',  8277.00,   9272.99, 109.40, 218.80),
    ('XII', 9273.00,  10312.99, 122.00, 244.00),
    ('XIII',10313.00, 11396.99, 135.30, 270.60),
    ('XIV', 11397.00, 12652.99, 149.90, 299.80),
    ('XV',  12653.00, 13599.99, 163.60, 327.20),
    ('XVI', 13600.00, NULL,     169.50, 339.00)
) AS c("classCode", "monthlyMin", "monthlyMax", "employeeWeeklyAmount", "employerWeeklyAmount")
WHERE NOT EXISTS (
  SELECT 1
  FROM "payroll"."nis_earnings_classes" n
  WHERE n."organizationId" = o."id"
    AND n."effectiveFrom" = DATE '2026-01-05'
);
