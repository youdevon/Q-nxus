-- Computer / hostname name for laptops and desktops.

ALTER TABLE "assets"."assets"
  ADD COLUMN IF NOT EXISTS "computerName" TEXT;
