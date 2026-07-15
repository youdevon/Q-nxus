/*
  Warnings:

  - The primary key for the `user_roles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[code]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,code]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `organizations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `roles` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `user_roles` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "core"."OrganizationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "core"."UserAccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "core"."RoleAssignmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "core"."ConfigurationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "core"."SettingDataType" AS ENUM ('STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME', 'JSON');

-- CreateEnum
CREATE TYPE "core"."SequenceResetFrequency" AS ENUM ('NEVER', 'MONTHLY', 'ANNUALLY', 'FINANCIAL_YEAR', 'MANUAL');

-- DropIndex
DROP INDEX "core"."roles_name_key";

-- AlterTable
ALTER TABLE "core"."organizations" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "dateFormat" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'TTD',
ADD COLUMN     "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "defaultTimeZone" TEXT NOT NULL DEFAULT 'America/Port_of_Spain',
ADD COLUMN     "firstDayOfWeek" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "core"."OrganizationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "core"."roles" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "core"."user_roles" DROP CONSTRAINT "user_roles_pkey",
ADD COLUMN     "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "effectiveUntil" TIMESTAMP(3),
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "status" "core"."RoleAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "core"."users" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "status" "core"."UserAccountStatus" NOT NULL DEFAULT 'INVITED',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "core"."permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "core"."business_units" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "core"."ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."locations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'TT',
    "postalCode" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Port_of_Spain',
    "status" "core"."ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."reference_data_sets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleKey" TEXT NOT NULL,
    "status" "core"."ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_data_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."reference_data_values" (
    "id" TEXT NOT NULL,
    "dataSetId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "core"."ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_data_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."feature_controls" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "featureCode" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "core"."ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."domain_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "settingCode" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dataType" "core"."SettingDataType" NOT NULL,
    "value" JSONB NOT NULL,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "status" "core"."ConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."numbering_sequences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sequenceCode" TEXT NOT NULL,
    "prefix" TEXT,
    "suffix" TEXT,
    "currentNumber" BIGINT NOT NULL DEFAULT 0,
    "minimumLength" INTEGER NOT NULL DEFAULT 5,
    "resetFrequency" "core"."SequenceResetFrequency" NOT NULL DEFAULT 'NEVER',
    "lastResetAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "numbering_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "core"."permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_moduleKey_idx" ON "core"."permissions"("moduleKey");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "core"."role_permissions"("permissionId");

-- CreateIndex
CREATE INDEX "business_units_organizationId_status_idx" ON "core"."business_units"("organizationId", "status");

-- CreateIndex
CREATE INDEX "business_units_parentId_idx" ON "core"."business_units"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "business_units_organizationId_code_key" ON "core"."business_units"("organizationId", "code");

-- CreateIndex
CREATE INDEX "locations_organizationId_status_idx" ON "core"."locations"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "locations_organizationId_code_key" ON "core"."locations"("organizationId", "code");

-- CreateIndex
CREATE INDEX "reference_data_sets_moduleKey_idx" ON "core"."reference_data_sets"("moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "reference_data_sets_organizationId_code_key" ON "core"."reference_data_sets"("organizationId", "code");

-- CreateIndex
CREATE INDEX "reference_data_values_dataSetId_status_idx" ON "core"."reference_data_values"("dataSetId", "status");

-- CreateIndex
CREATE INDEX "reference_data_values_parentId_idx" ON "core"."reference_data_values"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "reference_data_values_dataSetId_code_key" ON "core"."reference_data_values"("dataSetId", "code");

-- CreateIndex
CREATE INDEX "feature_controls_organizationId_isEnabled_idx" ON "core"."feature_controls"("organizationId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "feature_controls_organizationId_featureCode_key" ON "core"."feature_controls"("organizationId", "featureCode");

-- CreateIndex
CREATE INDEX "domain_settings_organizationId_moduleKey_idx" ON "core"."domain_settings"("organizationId", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "domain_settings_organizationId_settingCode_key" ON "core"."domain_settings"("organizationId", "settingCode");

-- CreateIndex
CREATE INDEX "numbering_sequences_organizationId_isActive_idx" ON "core"."numbering_sequences"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "numbering_sequences_organizationId_sequenceCode_key" ON "core"."numbering_sequences"("organizationId", "sequenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "core"."organizations"("code");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "core"."organizations"("status");

-- CreateIndex
CREATE INDEX "roles_organizationId_idx" ON "core"."roles"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organizationId_code_key" ON "core"."roles"("organizationId", "code");

-- CreateIndex
CREATE INDEX "user_roles_userId_status_idx" ON "core"."user_roles"("userId", "status");

-- CreateIndex
CREATE INDEX "user_roles_roleId_status_idx" ON "core"."user_roles"("roleId", "status");

-- CreateIndex
CREATE INDEX "user_roles_effectiveFrom_effectiveUntil_idx" ON "core"."user_roles"("effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE INDEX "users_organizationId_status_idx" ON "core"."users"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "core"."roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "core"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "core"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."business_units" ADD CONSTRAINT "business_units_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."business_units" ADD CONSTRAINT "business_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "core"."business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."locations" ADD CONSTRAINT "locations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."reference_data_sets" ADD CONSTRAINT "reference_data_sets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."reference_data_values" ADD CONSTRAINT "reference_data_values_dataSetId_fkey" FOREIGN KEY ("dataSetId") REFERENCES "core"."reference_data_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."reference_data_values" ADD CONSTRAINT "reference_data_values_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "core"."reference_data_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."feature_controls" ADD CONSTRAINT "feature_controls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."domain_settings" ADD CONSTRAINT "domain_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."numbering_sequences" ADD CONSTRAINT "numbering_sequences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
