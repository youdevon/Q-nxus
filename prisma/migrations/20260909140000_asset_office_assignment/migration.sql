-- Allow office/location custody as well as employee custody.

ALTER TYPE "assets"."AssetAssignmentType" ADD VALUE IF NOT EXISTS 'OFFICE';

ALTER TABLE "assets"."asset_assignments"
  ALTER COLUMN "employeeId" DROP NOT NULL;

ALTER TABLE "assets"."asset_assignments"
  ADD COLUMN IF NOT EXISTS "locationId" TEXT;

CREATE INDEX IF NOT EXISTS "asset_assignments_locationId_returnedAt_idx"
  ON "assets"."asset_assignments"("locationId", "returnedAt");

ALTER TABLE "assets"."asset_assignments"
  DROP CONSTRAINT IF EXISTS "asset_assignments_locationId_fkey";

ALTER TABLE "assets"."asset_assignments"
  ADD CONSTRAINT "asset_assignments_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "core"."locations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
