-- Pair accessories (e.g. monitors) under a primary asset (e.g. desktop).
ALTER TABLE "assets"."assets"
ADD COLUMN IF NOT EXISTS "parentAssetId" TEXT;

CREATE INDEX IF NOT EXISTS "assets_parentAssetId_idx"
  ON "assets"."assets"("parentAssetId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_parentAssetId_fkey'
  ) THEN
    ALTER TABLE "assets"."assets"
      ADD CONSTRAINT "assets_parentAssetId_fkey"
      FOREIGN KEY ("parentAssetId")
      REFERENCES "assets"."assets"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
