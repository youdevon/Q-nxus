-- Organization holidays used for leave working-day counting
CREATE TABLE IF NOT EXISTS "hr"."organization_holidays" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "holidayDate" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_holidays_organizationId_holidayDate_name_key"
ON "hr"."organization_holidays"("organizationId", "holidayDate", "name");

CREATE INDEX IF NOT EXISTS "organization_holidays_organizationId_holidayDate_idx"
ON "hr"."organization_holidays"("organizationId", "holidayDate");

CREATE INDEX IF NOT EXISTS "organization_holidays_organizationId_isActive_idx"
ON "hr"."organization_holidays"("organizationId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_holidays_organizationId_fkey'
  ) THEN
    ALTER TABLE "hr"."organization_holidays"
      ADD CONSTRAINT "organization_holidays_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
