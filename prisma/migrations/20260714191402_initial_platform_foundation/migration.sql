-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "hr";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notifications";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "payroll";

-- CreateEnum
CREATE TYPE "core"."ModuleHealth" AS ENUM ('OPERATIONAL', 'DEGRADED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "hr"."EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RETIRED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "hr"."EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'TEMPORARY', 'PART_TIME', 'INTERN', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "notifications"."NotificationSeverity" AS ENUM ('SUCCESS', 'INFORMATION', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "notifications"."NotificationReadStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateTable
CREATE TABLE "core"."organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "legalName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."application_settings" (
    "id" TEXT NOT NULL,
    "internalCodename" TEXT NOT NULL DEFAULT 'Q-NXUS',
    "displayName" TEXT NOT NULL DEFAULT 'Q-NXUS',
    "shortName" TEXT NOT NULL DEFAULT 'Q-NXUS',
    "organizationName" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "core"."module_statuses" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "health" "core"."ModuleHealth" NOT NULL DEFAULT 'OPERATIONAL',
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."departments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."positions" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employees" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT,
    "positionId" TEXT,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "workEmail" TEXT,
    "personalEmail" TEXT,
    "phone" TEXT,
    "employmentStatus" "hr"."EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "employmentType" "hr"."EmploymentType" NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "terminationDate" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employment_contracts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "jobTitle" TEXT NOT NULL,
    "baseSalary" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll"."payroll_profiles" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "taxIdentifier" TEXT,
    "isPayrollReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "notifications"."NotificationSeverity" NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "actionUrl" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notification_recipients" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "notifications"."NotificationReadStatus" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("notificationId","userId")
);

-- CreateTable
CREATE TABLE "audit"."audit_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "moduleKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "core"."users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "core"."users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "core"."roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "module_statuses_moduleKey_key" ON "core"."module_statuses"("moduleKey");

-- CreateIndex
CREATE INDEX "departments_organizationId_idx" ON "hr"."departments"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organizationId_name_key" ON "hr"."departments"("organizationId", "name");

-- CreateIndex
CREATE INDEX "positions_departmentId_idx" ON "hr"."positions"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "positions_departmentId_title_key" ON "hr"."positions"("departmentId", "title");

-- CreateIndex
CREATE INDEX "employees_organizationId_idx" ON "hr"."employees"("organizationId");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "hr"."employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_positionId_idx" ON "hr"."employees"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organizationId_employeeNumber_key" ON "hr"."employees"("organizationId", "employeeNumber");

-- CreateIndex
CREATE INDEX "employment_contracts_employeeId_idx" ON "hr"."employment_contracts"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_profiles_employeeId_key" ON "payroll"."payroll_profiles"("employeeId");

-- CreateIndex
CREATE INDEX "notifications_moduleKey_idx" ON "notifications"."notifications"("moduleKey");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"."notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notification_recipients_userId_status_idx" ON "notifications"."notification_recipients"("userId", "status");

-- CreateIndex
CREATE INDEX "audit_events_userId_idx" ON "audit"."audit_events"("userId");

-- CreateIndex
CREATE INDEX "audit_events_moduleKey_idx" ON "audit"."audit_events"("moduleKey");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit"."audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit"."audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "core"."users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "core"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."departments" ADD CONSTRAINT "departments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."positions" ADD CONSTRAINT "positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "hr"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employment_contracts" ADD CONSTRAINT "employment_contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll"."payroll_profiles" ADD CONSTRAINT "payroll_profiles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"."notification_recipients" ADD CONSTRAINT "notification_recipients_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"."notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"."notification_recipients" ADD CONSTRAINT "notification_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit"."audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
