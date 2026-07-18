-- Related correspondence linkage (e.g. offer letter → assumption of duty)
ALTER TABLE "hr"."employee_correspondences"
  ADD COLUMN IF NOT EXISTS "relatedCorrespondenceId" TEXT;

CREATE INDEX IF NOT EXISTS "employee_correspondences_relatedCorrespondenceId_idx"
  ON "hr"."employee_correspondences"("relatedCorrespondenceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_correspondences_relatedCorrespondenceId_fkey'
  ) THEN
    ALTER TABLE "hr"."employee_correspondences"
      ADD CONSTRAINT "employee_correspondences_relatedCorrespondenceId_fkey"
      FOREIGN KEY ("relatedCorrespondenceId")
      REFERENCES "hr"."employee_correspondences"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Employee file update requests (qualification update requests)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'EmployeeFileUpdateRequestStatus' AND n.nspname = 'hr'
  ) THEN
    CREATE TYPE "hr"."EmployeeFileUpdateRequestStatus" AS ENUM ('OPEN', 'RESOLVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'EmployeeFileUpdateRequestType' AND n.nspname = 'hr'
  ) THEN
    CREATE TYPE "hr"."EmployeeFileUpdateRequestType" AS ENUM ('QUALIFICATION_UPDATE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "hr"."employee_file_update_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "requestType" "hr"."EmployeeFileUpdateRequestType" NOT NULL DEFAULT 'QUALIFICATION_UPDATE',
  "title" TEXT NOT NULL,
  "note" TEXT,
  "status" "hr"."EmployeeFileUpdateRequestStatus" NOT NULL DEFAULT 'OPEN',
  "requestedByUserId" TEXT NOT NULL,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_file_update_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "employee_file_update_requests_organizationId_idx"
  ON "hr"."employee_file_update_requests"("organizationId");

CREATE INDEX IF NOT EXISTS "employee_file_update_requests_employeeId_status_idx"
  ON "hr"."employee_file_update_requests"("employeeId", "status");

CREATE INDEX IF NOT EXISTS "employee_file_update_requests_requestedByUserId_idx"
  ON "hr"."employee_file_update_requests"("requestedByUserId");

CREATE INDEX IF NOT EXISTS "employee_file_update_requests_resolvedByUserId_idx"
  ON "hr"."employee_file_update_requests"("resolvedByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_file_update_requests_organizationId_fkey'
  ) THEN
    ALTER TABLE "hr"."employee_file_update_requests"
      ADD CONSTRAINT "employee_file_update_requests_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_file_update_requests_employeeId_fkey'
  ) THEN
    ALTER TABLE "hr"."employee_file_update_requests"
      ADD CONSTRAINT "employee_file_update_requests_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_file_update_requests_requestedByUserId_fkey'
  ) THEN
    ALTER TABLE "hr"."employee_file_update_requests"
      ADD CONSTRAINT "employee_file_update_requests_requestedByUserId_fkey"
      FOREIGN KEY ("requestedByUserId") REFERENCES "core"."users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_file_update_requests_resolvedByUserId_fkey'
  ) THEN
    ALTER TABLE "hr"."employee_file_update_requests"
      ADD CONSTRAINT "employee_file_update_requests_resolvedByUserId_fkey"
      FOREIGN KEY ("resolvedByUserId") REFERENCES "core"."users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
