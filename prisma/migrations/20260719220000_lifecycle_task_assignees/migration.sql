-- AlterTable EmployeeOnboardingTask
ALTER TABLE "hr"."employee_onboarding_tasks"
  ADD COLUMN "assigneeUserId" TEXT;

-- AlterTable EmployeeOffboardingTask
ALTER TABLE "hr"."employee_offboarding_tasks"
  ADD COLUMN "assigneeUserId" TEXT;

-- CreateIndex
CREATE INDEX "employee_onboarding_tasks_assigneeUserId_idx" ON "hr"."employee_onboarding_tasks"("assigneeUserId");

CREATE INDEX "employee_onboarding_tasks_dueAt_idx" ON "hr"."employee_onboarding_tasks"("dueAt");

CREATE INDEX "employee_offboarding_tasks_assigneeUserId_idx" ON "hr"."employee_offboarding_tasks"("assigneeUserId");

CREATE INDEX "employee_offboarding_tasks_dueAt_idx" ON "hr"."employee_offboarding_tasks"("dueAt");

-- AddForeignKey
ALTER TABLE "hr"."employee_onboarding_tasks"
  ADD CONSTRAINT "employee_onboarding_tasks_assigneeUserId_fkey"
  FOREIGN KEY ("assigneeUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hr"."employee_offboarding_tasks"
  ADD CONSTRAINT "employee_offboarding_tasks_assigneeUserId_fkey"
  FOREIGN KEY ("assigneeUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
