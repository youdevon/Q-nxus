-- Payroll phase 1: pay master data, bank splits, and central statutory rates

CREATE TYPE "payroll"."PayFrequency" AS ENUM (
  'MONTHLY',
  'FORTNIGHTLY',
  'WEEKLY',
  'BIWEEKLY',
  'SEMI_MONTHLY'
);

CREATE TYPE "payroll"."PayrollPaymentMethod" AS ENUM (
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH'
);

CREATE TYPE "payroll"."StatutoryRateType" AS ENUM (
  'NIS_EMPLOYEE',
  'NIS_EMPLOYER',
  'PAYE'
);

ALTER TABLE "payroll"."payroll_profiles"
  ADD COLUMN IF NOT EXISTS "payFrequency" "payroll"."PayFrequency" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "nisNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "birNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Preserve legacy tax identifier into BIR number when present
UPDATE "payroll"."payroll_profiles"
SET "birNumber" = "taxIdentifier"
WHERE "taxIdentifier" IS NOT NULL
  AND ("birNumber" IS NULL OR BTRIM("birNumber") = '');

-- Rename legacy string paymentMethod, then replace with enum
ALTER TABLE "payroll"."payroll_profiles"
  RENAME COLUMN "paymentMethod" TO "paymentMethodLegacy";

ALTER TABLE "payroll"."payroll_profiles"
  ADD COLUMN "paymentMethod" "payroll"."PayrollPaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER';

UPDATE "payroll"."payroll_profiles"
SET "paymentMethod" = CASE
  WHEN UPPER(COALESCE("paymentMethodLegacy", '')) IN ('CHEQUE', 'CHECK') THEN 'CHEQUE'::"payroll"."PayrollPaymentMethod"
  WHEN UPPER(COALESCE("paymentMethodLegacy", '')) = 'CASH' THEN 'CASH'::"payroll"."PayrollPaymentMethod"
  ELSE 'BANK_TRANSFER'::"payroll"."PayrollPaymentMethod"
END;

ALTER TABLE "payroll"."payroll_profiles"
  DROP COLUMN "paymentMethodLegacy";

CREATE TABLE IF NOT EXISTS "payroll"."payroll_bank_accounts" (
  "id" TEXT NOT NULL,
  "payrollProfileId" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "branchName" TEXT,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT,
  "percentage" DECIMAL(5,2) NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payroll_bank_accounts_payrollProfileId_idx"
  ON "payroll"."payroll_bank_accounts"("payrollProfileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_bank_accounts_payrollProfileId_fkey'
  ) THEN
    ALTER TABLE "payroll"."payroll_bank_accounts"
      ADD CONSTRAINT "payroll_bank_accounts_payrollProfileId_fkey"
      FOREIGN KEY ("payrollProfileId") REFERENCES "payroll"."payroll_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Migrate legacy single bank fields into a 100% primary account
INSERT INTO "payroll"."payroll_bank_accounts" (
  "id",
  "payrollProfileId",
  "bankName",
  "accountNumber",
  "percentage",
  "isPrimary",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || p."id"),
  p."id",
  COALESCE(NULLIF(BTRIM(p."bankName"), ''), 'Unknown bank'),
  COALESCE(NULLIF(BTRIM(p."bankAccountNo"), ''), 'UNKNOWN'),
  100.00,
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "payroll"."payroll_profiles" p
WHERE (
    (p."bankName" IS NOT NULL AND BTRIM(p."bankName") <> '')
    OR (p."bankAccountNo" IS NOT NULL AND BTRIM(p."bankAccountNo") <> '')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "payroll"."payroll_bank_accounts" b
    WHERE b."payrollProfileId" = p."id"
  );

ALTER TABLE "payroll"."payroll_profiles"
  DROP COLUMN IF EXISTS "bankName",
  DROP COLUMN IF EXISTS "bankAccountNo",
  DROP COLUMN IF EXISTS "taxIdentifier";

CREATE TABLE IF NOT EXISTS "payroll"."statutory_rates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "rateType" "payroll"."StatutoryRateType" NOT NULL,
  "ratePercent" DECIMAL(7,4) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "statutory_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "statutory_rates_organizationId_rateType_effectiveFrom_idx"
  ON "payroll"."statutory_rates"("organizationId", "rateType", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "statutory_rates_organizationId_isActive_idx"
  ON "payroll"."statutory_rates"("organizationId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'statutory_rates_organizationId_fkey'
  ) THEN
    ALTER TABLE "payroll"."statutory_rates"
      ADD CONSTRAINT "statutory_rates_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
