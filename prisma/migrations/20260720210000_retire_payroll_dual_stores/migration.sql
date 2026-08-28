-- Retire dual-storage:
-- 1) Backfill TD1 from payroll_profiles → employee_tax_profiles (current calendar year)
-- 2) Backfill NIS/BIR from payroll_profiles → employees when employee fields are empty
-- 3) Drop deprecated payroll.payroll_bank_accounts
-- 4) Drop mirrored columns from payroll.payroll_profiles

-- Gap-fill Employee NIS from legacy payroll profile mirror.
UPDATE "hr"."employees" AS e
SET "nisNumber" = pp."nisNumber"
FROM "payroll"."payroll_profiles" AS pp
WHERE pp."employeeId" = e."id"
  AND (e."nisNumber" IS NULL OR btrim(e."nisNumber") = '')
  AND pp."nisNumber" IS NOT NULL
  AND btrim(pp."nisNumber") <> '';

-- Gap-fill Employee BIR from legacy payroll profile mirror.
UPDATE "hr"."employees" AS e
SET "birNumber" = pp."birNumber"
FROM "payroll"."payroll_profiles" AS pp
WHERE pp."employeeId" = e."id"
  AND (e."birNumber" IS NULL OR btrim(e."birNumber") = '')
  AND pp."birNumber" IS NOT NULL
  AND btrim(pp."birNumber") <> '';

-- Upsert current-year tax profiles from payroll-profile TD1 when missing / null.
INSERT INTO "payroll"."employee_tax_profiles" (
  "id",
  "organizationId",
  "employeeId",
  "taxYear",
  "taxCalculationMethod",
  "taxProfileStatus",
  "personalAllowanceSource",
  "td1OtherApprovedAnnual",
  "effectiveFrom",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('td1bf_', pp."id"),
  e."organizationId",
  e."id",
  EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  'STANDARD_NON_CUMULATIVE'::"payroll"."TaxCalculationMethod",
  'ACTIVE'::"payroll"."EmployeeTaxProfileStatus",
  'STATUTORY_DEFAULT'::"payroll"."PersonalAllowanceSource",
  pp."td1OtherApprovedAnnual",
  make_date(EXTRACT(YEAR FROM CURRENT_DATE)::integer, 1, 1),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "payroll"."payroll_profiles" AS pp
INNER JOIN "hr"."employees" AS e ON e."id" = pp."employeeId"
WHERE pp."td1OtherApprovedAnnual" IS NOT NULL
ON CONFLICT ("employeeId", "taxYear") DO UPDATE
SET
  "td1OtherApprovedAnnual" = COALESCE(
    "payroll"."employee_tax_profiles"."td1OtherApprovedAnnual",
    EXCLUDED."td1OtherApprovedAnnual"
  ),
  "updatedAt" = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS "payroll"."payroll_bank_accounts";

ALTER TABLE "payroll"."payroll_profiles"
  DROP COLUMN IF EXISTS "nisNumber",
  DROP COLUMN IF EXISTS "birNumber",
  DROP COLUMN IF EXISTS "td1OtherApprovedAnnual";
