-- P0-2: Repair duplicate current assignments (keep newest), then enforce uniqueness.
WITH ranked_assignments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "employeeId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS rn
  FROM hr.employee_assignments
  WHERE "isCurrent" = true
)
UPDATE hr.employee_assignments AS a
SET
  "isCurrent" = false,
  "endDate" = COALESCE(a."endDate", CURRENT_DATE),
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_assignments AS r
WHERE a.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS employee_assignments_one_current
  ON hr.employee_assignments ("employeeId")
  WHERE "isCurrent" = true;

-- P0-2: Repair duplicate current contracts (keep newest), demote others.
WITH ranked_contracts AS (
  SELECT
    id,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY "employeeId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS rn
  FROM hr.employment_contracts
  WHERE "isCurrent" = true
)
UPDATE hr.employment_contracts AS c
SET
  "isCurrent" = false,
  status = CASE
    WHEN c.status = 'ACTIVE'::hr."EmploymentContractStatus" THEN
      CASE
        WHEN c."terminationDate" IS NOT NULL THEN 'TERMINATED'::hr."EmploymentContractStatus"
        ELSE 'EXPIRED'::hr."EmploymentContractStatus"
      END
    ELSE c.status
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_contracts AS r
WHERE c.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS employment_contracts_one_current
  ON hr.employment_contracts ("employeeId")
  WHERE "isCurrent" = true;

-- P0-4: Null invalid sourcePositionId values before adding the FK.
UPDATE core.user_roles AS ur
SET "sourcePositionId" = NULL
WHERE ur."sourcePositionId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM hr.positions AS p
    WHERE p.id = ur."sourcePositionId"
  );

ALTER TABLE core.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_sourcePositionId_fkey;

ALTER TABLE core.user_roles
  ADD CONSTRAINT user_roles_sourcePositionId_fkey
  FOREIGN KEY ("sourcePositionId")
  REFERENCES hr.positions(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- P1-8: Optional organization scope on audit events.
ALTER TABLE audit.audit_events
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE audit.audit_events AS ae
SET "organizationId" = u."organizationId"
FROM core.users AS u
WHERE ae."organizationId" IS NULL
  AND ae."userId" = u.id
  AND u."organizationId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_events_organizationId_idx
  ON audit.audit_events ("organizationId");

ALTER TABLE audit.audit_events
  DROP CONSTRAINT IF EXISTS audit_events_organizationId_fkey;

ALTER TABLE audit.audit_events
  ADD CONSTRAINT audit_events_organizationId_fkey
  FOREIGN KEY ("organizationId")
  REFERENCES core.organizations(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
