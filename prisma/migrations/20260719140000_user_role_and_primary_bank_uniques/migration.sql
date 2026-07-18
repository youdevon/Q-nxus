-- Optional uniqueness hardening from snappy audit Wave follow-up.
-- Partial uniques preserve revoke/re-assign and multi-account history.

-- ---------------------------------------------------------------------------
-- UserRole: at most one ACTIVE/PENDING grant per (user, role)
-- Keep newest active row when duplicates already exist.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "roleId"
      ORDER BY "assignedAt" DESC, id DESC
    ) AS rn
  FROM "core"."user_roles"
  WHERE status IN ('ACTIVE', 'PENDING')
)
UPDATE "core"."user_roles" AS ur
SET
  status = 'REVOKED',
  "revokedAt" = COALESCE(ur."revokedAt", NOW()),
  reason = COALESCE(ur.reason, 'Deduplicated before unique index')
FROM ranked
WHERE ur.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_userId_roleId_active_key"
  ON "core"."user_roles" ("userId", "roleId")
  WHERE status IN ('ACTIVE', 'PENDING');

-- ---------------------------------------------------------------------------
-- EmployeeBankAccount: at most one active primary per employee
-- Prefer lowest sortOrder, then oldest createdAt when clearing duplicates.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "employeeId"
      ORDER BY "sortOrder" ASC, "createdAt" ASC, id ASC
    ) AS rn
  FROM "payroll"."employee_bank_accounts"
  WHERE "isPrimary" = true
    AND "isActive" = true
    AND "archivedAt" IS NULL
)
UPDATE "payroll"."employee_bank_accounts" AS ba
SET "isPrimary" = false
FROM ranked
WHERE ba.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "employee_bank_accounts_one_primary_per_employee"
  ON "payroll"."employee_bank_accounts" ("employeeId")
  WHERE "isPrimary" = true
    AND "isActive" = true
    AND "archivedAt" IS NULL;
