-- Consolidate service tag into serialNumber (single device identifier).

ALTER TABLE "assets"."assets" DROP COLUMN IF EXISTS "serviceTag";
