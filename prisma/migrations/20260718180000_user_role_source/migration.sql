-- Add UserRole provenance so position sync can revoke/create by metadata
-- instead of English reason-string prefixes.

CREATE TYPE "core"."UserRoleSource" AS ENUM ('MANUAL', 'POSITION', 'SELF_SERVICE', 'SYSTEM');

ALTER TABLE "core"."user_roles"
  ADD COLUMN "source" "core"."UserRoleSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sourcePositionId" TEXT;

-- Backfill position-linked grants from legacy reason text.
UPDATE "core"."user_roles"
SET "source" = 'POSITION'
WHERE "reason" LIKE 'Access granted from position role%';

-- Backfill default self-service EMPLOYEE grants.
UPDATE "core"."user_roles"
SET "source" = 'SELF_SERVICE'
WHERE "reason" = 'Default employee self-service access.';

CREATE INDEX "user_roles_userId_source_status_idx"
  ON "core"."user_roles"("userId", "source", "status");

CREATE INDEX "user_roles_sourcePositionId_idx"
  ON "core"."user_roles"("sourcePositionId");
