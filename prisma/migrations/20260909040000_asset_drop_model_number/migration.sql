-- Consolidate model number into modelName.

ALTER TABLE "assets"."assets" DROP COLUMN IF EXISTS "modelNumber";
