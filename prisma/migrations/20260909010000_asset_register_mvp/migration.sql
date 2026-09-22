-- Asset register MVP (assets schema)

CREATE SCHEMA IF NOT EXISTS "assets";

CREATE TYPE "assets"."AssetStatus" AS ENUM (
  'AVAILABLE',
  'ASSIGNED',
  'IN_REPAIR',
  'RETIRED',
  'LOST',
  'STOLEN'
);

CREATE TYPE "assets"."AssetCondition" AS ENUM (
  'NEW',
  'GOOD',
  'FAIR',
  'POOR'
);

CREATE TYPE "assets"."AssetCategory" AS ENUM (
  'COMPUTER_EQUIPMENT',
  'MOBILE_DEVICES',
  'OFFICE_EQUIPMENT',
  'FURNITURE',
  'OTHER'
);

CREATE TYPE "assets"."AssetType" AS ENUM (
  'LAPTOP',
  'DESKTOP',
  'MONITOR',
  'PHONE',
  'TABLET',
  'DOCK',
  'KEYBOARD',
  'MOUSE',
  'PRINTER',
  'OTHER'
);

CREATE TYPE "assets"."AssetAssignmentType" AS ENUM (
  'ISSUE',
  'TRANSFER',
  'RETURN',
  'OFFBOARDING',
  'LOAN',
  'REPLACEMENT'
);

CREATE TYPE "assets"."AssetDocumentKind" AS ENUM (
  'RECEIPT',
  'PHOTO',
  'HANDOVER',
  'OTHER'
);

CREATE TABLE "assets"."assets" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetNumber" TEXT NOT NULL,
  "assetTag" TEXT,
  "category" "assets"."AssetCategory" NOT NULL DEFAULT 'COMPUTER_EQUIPMENT',
  "assetType" "assets"."AssetType" NOT NULL DEFAULT 'LAPTOP',
  "manufacturer" TEXT,
  "modelName" TEXT,
  "modelNumber" TEXT,
  "serialNumber" TEXT,
  "serviceTag" TEXT,
  "description" TEXT,
  "status" "assets"."AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
  "condition" "assets"."AssetCondition" NOT NULL DEFAULT 'GOOD',
  "purchaseDate" DATE,
  "receivedDate" DATE,
  "purchaseCost" DECIMAL(14,2),
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "warrantyEndsOn" DATE,
  "notes" TEXT,
  "assignedEmployeeId" TEXT,
  "locationId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assets"."asset_assignments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assignmentType" "assets"."AssetAssignmentType" NOT NULL DEFAULT 'ISSUE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "conditionAtIssue" "assets"."AssetCondition",
  "conditionAtReturn" "assets"."AssetCondition",
  "notes" TEXT,
  "assignedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assets"."asset_documents" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "storedFileId" TEXT NOT NULL,
  "kind" "assets"."AssetDocumentKind" NOT NULL DEFAULT 'OTHER',
  "notes" TEXT,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asset_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assets_organizationId_assetNumber_key" ON "assets"."assets"("organizationId", "assetNumber");
CREATE UNIQUE INDEX "assets_organizationId_serialNumber_key" ON "assets"."assets"("organizationId", "serialNumber");
CREATE INDEX "assets_organizationId_status_idx" ON "assets"."assets"("organizationId", "status");
CREATE INDEX "assets_organizationId_assetType_idx" ON "assets"."assets"("organizationId", "assetType");
CREATE INDEX "assets_organizationId_warrantyEndsOn_idx" ON "assets"."assets"("organizationId", "warrantyEndsOn");
CREATE INDEX "assets_assignedEmployeeId_idx" ON "assets"."assets"("assignedEmployeeId");
CREATE INDEX "assets_locationId_idx" ON "assets"."assets"("locationId");

CREATE INDEX "asset_assignments_organizationId_assetId_returnedAt_idx" ON "assets"."asset_assignments"("organizationId", "assetId", "returnedAt");
CREATE INDEX "asset_assignments_employeeId_returnedAt_idx" ON "assets"."asset_assignments"("employeeId", "returnedAt");
CREATE INDEX "asset_assignments_assetId_assignedAt_idx" ON "assets"."asset_assignments"("assetId", "assignedAt");

CREATE INDEX "asset_documents_organizationId_assetId_idx" ON "assets"."asset_documents"("organizationId", "assetId");
CREATE INDEX "asset_documents_storedFileId_idx" ON "assets"."asset_documents"("storedFileId");

ALTER TABLE "assets"."assets"
  ADD CONSTRAINT "assets_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assets"."assets"
  ADD CONSTRAINT "assets_assignedEmployeeId_fkey"
  FOREIGN KEY ("assignedEmployeeId") REFERENCES "hr"."employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assets"."assets"
  ADD CONSTRAINT "assets_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "core"."locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assets"."asset_assignments"
  ADD CONSTRAINT "asset_assignments_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assets"."asset_assignments"
  ADD CONSTRAINT "asset_assignments_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"."assets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assets"."asset_assignments"
  ADD CONSTRAINT "asset_assignments_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assets"."asset_assignments"
  ADD CONSTRAINT "asset_assignments_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assets"."asset_documents"
  ADD CONSTRAINT "asset_documents_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assets"."asset_documents"
  ADD CONSTRAINT "asset_documents_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"."assets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assets"."asset_documents"
  ADD CONSTRAINT "asset_documents_storedFileId_fkey"
  FOREIGN KEY ("storedFileId") REFERENCES "hr"."stored_files"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assets"."asset_documents"
  ADD CONSTRAINT "asset_documents_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
