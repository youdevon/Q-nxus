-- Hire/exit pack templates for lifecycle case task resolution

CREATE TYPE "hr"."LifecycleTemplateKind" AS ENUM ('ONBOARDING', 'OFFBOARDING');

CREATE TABLE "hr"."employee_lifecycle_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "hr"."LifecycleTemplateKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "matchCaseType" "hr"."OnboardingCaseType",
    "matchReasonCode" "hr"."OffboardingCaseReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_lifecycle_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hr"."employee_lifecycle_template_tasks" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" "hr"."LifecycleTaskCode" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_lifecycle_template_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_lifecycle_templates_organizationId_code_key"
  ON "hr"."employee_lifecycle_templates"("organizationId", "code");

CREATE INDEX "employee_lifecycle_templates_organizationId_kind_isActive_idx"
  ON "hr"."employee_lifecycle_templates"("organizationId", "kind", "isActive");

CREATE INDEX "employee_lifecycle_templates_organizationId_kind_isDefault_idx"
  ON "hr"."employee_lifecycle_templates"("organizationId", "kind", "isDefault");

CREATE UNIQUE INDEX "employee_lifecycle_template_tasks_templateId_code_key"
  ON "hr"."employee_lifecycle_template_tasks"("templateId", "code");

CREATE INDEX "employee_lifecycle_template_tasks_templateId_sortOrder_idx"
  ON "hr"."employee_lifecycle_template_tasks"("templateId", "sortOrder");

ALTER TABLE "hr"."employee_lifecycle_templates"
  ADD CONSTRAINT "employee_lifecycle_templates_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr"."employee_lifecycle_template_tasks"
  ADD CONSTRAINT "employee_lifecycle_template_tasks_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "hr"."employee_lifecycle_templates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
