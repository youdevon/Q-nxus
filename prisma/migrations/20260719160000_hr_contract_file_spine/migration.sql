-- Contract governance + file spine + onboarding/offboarding + packs

-- Expand employment contract status enum
ALTER TYPE "hr"."EmploymentContractStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "hr"."EmploymentContractStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "hr"."EmploymentContractStatus" ADD VALUE IF NOT EXISTS 'AWAITING_SIGNATURE';

CREATE TYPE "hr"."ContractApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "hr"."ContractWorkflowMode" AS ENUM ('PEOPLE_MANAGE_AUTO', 'FINAL_APPROVER_POSITION');
CREATE TYPE "hr"."OnboardingCaseStatus" AS ENUM ('OPEN', 'READY', 'COMPLETED', 'CANCELLED');
CREATE TYPE "hr"."OffboardingCaseStatus" AS ENUM ('OPEN', 'CLEARED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "hr"."LifecycleTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'BLOCKED');
CREATE TYPE "hr"."LifecycleTaskCode" AS ENUM (
  'CREATE_DRAFT_CONTRACT',
  'SEED_FILE_CHECKLIST',
  'ISSUE_ASSUMPTION_OF_DUTY',
  'COMPLETE_REQUIRED_DOCS',
  'ACTIVATE_CONTRACT',
  'PAYROLL_READINESS',
  'CLOSE_CONTRACT',
  'FREEZE_EMPLOYEE_FILE',
  'REVOKE_ACCESS',
  'FINAL_PAY_CHECK'
);

-- Expand file update request types
ALTER TYPE "hr"."EmployeeFileUpdateRequestType" ADD VALUE IF NOT EXISTS 'COPY_OF_ID';
ALTER TYPE "hr"."EmployeeFileUpdateRequestType" ADD VALUE IF NOT EXISTS 'BIRTH_CERTIFICATE';
ALTER TYPE "hr"."EmployeeFileUpdateRequestType" ADD VALUE IF NOT EXISTS 'CREDENTIAL';
ALTER TYPE "hr"."EmployeeFileUpdateRequestType" ADD VALUE IF NOT EXISTS 'TRAINING';
ALTER TYPE "hr"."EmployeeFileUpdateRequestType" ADD VALUE IF NOT EXISTS 'OTHER';

-- Stored files spine
CREATE TABLE "hr"."stored_files" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "checksumSha256" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionUntil" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stored_files_organizationId_storageKey_key" ON "hr"."stored_files"("organizationId", "storageKey");
CREATE INDEX "stored_files_organizationId_idx" ON "hr"."stored_files"("organizationId");
CREATE INDEX "stored_files_uploadedByUserId_idx" ON "hr"."stored_files"("uploadedByUserId");
CREATE INDEX "stored_files_retentionUntil_idx" ON "hr"."stored_files"("retentionUntil");
CREATE INDEX "stored_files_legalHold_idx" ON "hr"."stored_files"("legalHold");

ALTER TABLE "hr"."stored_files" ADD CONSTRAINT "stored_files_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr"."stored_files" ADD CONSTRAINT "stored_files_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee file freeze
ALTER TABLE "hr"."employees" ADD COLUMN IF NOT EXISTS "fileFrozenAt" TIMESTAMP(3);

-- Employment contract governance columns
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "positionId" TEXT;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "fte" DECIMAL(5,2);
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "standardHoursPerWeek" DECIMAL(6,2);
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "probationEndDate" DATE;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "noticePeriodDays" INTEGER;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "employeeSignedAt" TIMESTAMP(3);
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "orgSignedAt" TIMESTAMP(3);
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "documentStorageKey" TEXT;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "documentFileName" TEXT;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "documentMimeType" TEXT;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "documentSize" INTEGER;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "storedFileId" TEXT;
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "vacationLeaveDaysOverride" DECIMAL(9,2);
ALTER TABLE "hr"."employment_contracts" ADD COLUMN IF NOT EXISTS "sickLeaveDaysOverride" DECIMAL(9,2);

-- Defaults for new contracts (existing ACTIVE rows keep isCurrent as-is)
ALTER TABLE "hr"."employment_contracts" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "hr"."employment_contracts" ALTER COLUMN "isCurrent" SET DEFAULT false;

CREATE INDEX IF NOT EXISTS "employment_contracts_positionId_idx" ON "hr"."employment_contracts"("positionId");
CREATE INDEX IF NOT EXISTS "employment_contracts_departmentId_idx" ON "hr"."employment_contracts"("departmentId");
CREATE INDEX IF NOT EXISTS "employment_contracts_approvedByUserId_idx" ON "hr"."employment_contracts"("approvedByUserId");
CREATE INDEX IF NOT EXISTS "employment_contracts_storedFileId_idx" ON "hr"."employment_contracts"("storedFileId");

ALTER TABLE "hr"."employment_contracts" ADD CONSTRAINT "employment_contracts_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "hr"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr"."employment_contracts" ADD CONSTRAINT "employment_contracts_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr"."employment_contracts" ADD CONSTRAINT "employment_contracts_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr"."employment_contracts" ADD CONSTRAINT "employment_contracts_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "hr"."stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "hr"."employment_contract_approval_steps" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverUserId" TEXT,
    "approverPositionId" TEXT,
    "status" "hr"."ContractApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_contract_approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employment_contract_approval_steps_contractId_stepNumber_key" ON "hr"."employment_contract_approval_steps"("contractId", "stepNumber");
CREATE INDEX "employment_contract_approval_steps_approverUserId_idx" ON "hr"."employment_contract_approval_steps"("approverUserId");
CREATE INDEX "employment_contract_approval_steps_approverPositionId_idx" ON "hr"."employment_contract_approval_steps"("approverPositionId");
CREATE INDEX "employment_contract_approval_steps_status_idx" ON "hr"."employment_contract_approval_steps"("status");

ALTER TABLE "hr"."employment_contract_approval_steps" ADD CONSTRAINT "employment_contract_approval_steps_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "hr"."employment_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr"."employment_contract_approval_steps" ADD CONSTRAINT "employment_contract_approval_steps_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr"."employment_contract_approval_steps" ADD CONSTRAINT "employment_contract_approval_steps_approverPositionId_fkey" FOREIGN KEY ("approverPositionId") REFERENCES "hr"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- File update request attachments
ALTER TABLE "hr"."employee_file_update_requests" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
ALTER TABLE "hr"."employee_file_update_requests" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "hr"."employee_file_update_requests" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
ALTER TABLE "hr"."employee_file_update_requests" ADD COLUMN IF NOT EXISTS "fileSize" INTEGER;
ALTER TABLE "hr"."employee_file_update_requests" ADD COLUMN IF NOT EXISTS "storedFileId" TEXT;
CREATE INDEX IF NOT EXISTS "employee_file_update_requests_storedFileId_idx" ON "hr"."employee_file_update_requests"("storedFileId");
ALTER TABLE "hr"."employee_file_update_requests" ADD CONSTRAINT "employee_file_update_requests_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "hr"."stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Configurable packs
CREATE TABLE "hr"."employee_file_packs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workforceCategory" "hr"."WorkforceCategory",
    "contractType" "hr"."EmploymentContractType",
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_file_packs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_file_packs_organizationId_code_key" ON "hr"."employee_file_packs"("organizationId", "code");
CREATE INDEX "employee_file_packs_organizationId_isActive_idx" ON "hr"."employee_file_packs"("organizationId", "isActive");
ALTER TABLE "hr"."employee_file_packs" ADD CONSTRAINT "employee_file_packs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hr"."employee_file_pack_items" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "itemType" "hr"."EmployeeFileChecklistItemType" NOT NULL,
    "label" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_file_pack_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_file_pack_items_packId_itemType_key" ON "hr"."employee_file_pack_items"("packId", "itemType");
CREATE INDEX "employee_file_pack_items_packId_sortOrder_idx" ON "hr"."employee_file_pack_items"("packId", "sortOrder");
ALTER TABLE "hr"."employee_file_pack_items" ADD CONSTRAINT "employee_file_pack_items_packId_fkey" FOREIGN KEY ("packId") REFERENCES "hr"."employee_file_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Onboarding / offboarding
CREATE TABLE "hr"."employee_onboarding_cases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "hr"."OnboardingCaseStatus" NOT NULL DEFAULT 'OPEN',
    "openedByUserId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_onboarding_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_onboarding_cases_organizationId_status_idx" ON "hr"."employee_onboarding_cases"("organizationId", "status");
CREATE INDEX "employee_onboarding_cases_employeeId_idx" ON "hr"."employee_onboarding_cases"("employeeId");
CREATE INDEX "employee_onboarding_cases_openedByUserId_idx" ON "hr"."employee_onboarding_cases"("openedByUserId");
ALTER TABLE "hr"."employee_onboarding_cases" ADD CONSTRAINT "employee_onboarding_cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr"."employee_onboarding_cases" ADD CONSTRAINT "employee_onboarding_cases_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr"."employee_onboarding_cases" ADD CONSTRAINT "employee_onboarding_cases_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "hr"."employee_onboarding_tasks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "code" "hr"."LifecycleTaskCode" NOT NULL,
    "label" TEXT NOT NULL,
    "status" "hr"."LifecycleTaskStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_onboarding_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_onboarding_tasks_caseId_code_key" ON "hr"."employee_onboarding_tasks"("caseId", "code");
CREATE INDEX "employee_onboarding_tasks_caseId_status_idx" ON "hr"."employee_onboarding_tasks"("caseId", "status");
CREATE INDEX "employee_onboarding_tasks_completedByUserId_idx" ON "hr"."employee_onboarding_tasks"("completedByUserId");
ALTER TABLE "hr"."employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "hr"."employee_onboarding_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr"."employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "hr"."employee_offboarding_cases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "hr"."OffboardingCaseStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "openedByUserId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_offboarding_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_offboarding_cases_organizationId_status_idx" ON "hr"."employee_offboarding_cases"("organizationId", "status");
CREATE INDEX "employee_offboarding_cases_employeeId_idx" ON "hr"."employee_offboarding_cases"("employeeId");
CREATE INDEX "employee_offboarding_cases_openedByUserId_idx" ON "hr"."employee_offboarding_cases"("openedByUserId");
ALTER TABLE "hr"."employee_offboarding_cases" ADD CONSTRAINT "employee_offboarding_cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr"."employee_offboarding_cases" ADD CONSTRAINT "employee_offboarding_cases_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr"."employee_offboarding_cases" ADD CONSTRAINT "employee_offboarding_cases_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "hr"."employee_offboarding_tasks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "code" "hr"."LifecycleTaskCode" NOT NULL,
    "label" TEXT NOT NULL,
    "status" "hr"."LifecycleTaskStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_offboarding_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_offboarding_tasks_caseId_code_key" ON "hr"."employee_offboarding_tasks"("caseId", "code");
CREATE INDEX "employee_offboarding_tasks_caseId_status_idx" ON "hr"."employee_offboarding_tasks"("caseId", "status");
CREATE INDEX "employee_offboarding_tasks_completedByUserId_idx" ON "hr"."employee_offboarding_tasks"("completedByUserId");
ALTER TABLE "hr"."employee_offboarding_tasks" ADD CONSTRAINT "employee_offboarding_tasks_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "hr"."employee_offboarding_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr"."employee_offboarding_tasks" ADD CONSTRAINT "employee_offboarding_tasks_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
