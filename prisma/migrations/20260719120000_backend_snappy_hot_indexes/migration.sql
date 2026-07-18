-- Hot-path indexes, leave-balance unique expansion, pay-run period Restrict.
-- Wave 1 snappy backend + Wave 2 posted-payroll Restrict.

-- ---------------------------------------------------------------------------
-- Employee leave balances: unique per contract + type + cycle window
-- ---------------------------------------------------------------------------
-- Prefer newest row when duplicate cycle windows exist.
DELETE FROM "hr"."employee_leave_balances" a
USING "hr"."employee_leave_balances" b
WHERE a.id < b.id
  AND a."contractId" = b."contractId"
  AND a."leaveTypeId" = b."leaveTypeId"
  AND a."cycleStart" = b."cycleStart"
  AND a."cycleEnd" = b."cycleEnd";

DROP INDEX IF EXISTS "hr"."employee_leave_balances_contractId_leaveTypeId_key";

CREATE UNIQUE INDEX "employee_leave_balances_contractId_leaveTypeId_cycleStart_cycleEnd_key"
  ON "hr"."employee_leave_balances"("contractId", "leaveTypeId", "cycleStart", "cycleEnd");

DROP INDEX IF EXISTS "hr"."employee_leave_balances_contractId_idx";

CREATE INDEX "employee_leave_balances_contractId_leaveTypeId_idx"
  ON "hr"."employee_leave_balances"("contractId", "leaveTypeId");

-- ---------------------------------------------------------------------------
-- Leave request workspace queues
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "leave_requests_organizationId_status_createdAt_idx"
  ON "hr"."leave_requests"("organizationId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "leave_requests_organizationId_status_submittedAt_idx"
  ON "hr"."leave_requests"("organizationId", "status", "submittedAt");

-- ---------------------------------------------------------------------------
-- Correspondence overdue-ack / effectiveDate sorts
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "employee_correspondences_employeeId_effectiveDate_idx"
  ON "hr"."employee_correspondences"("employeeId", "effectiveDate");

CREATE INDEX IF NOT EXISTS "employee_correspondences_organizationId_requiresAcknowledgement_status_issueDate_idx"
  ON "hr"."employee_correspondences"("organizationId", "requiresAcknowledgement", "status", "issueDate");

-- ---------------------------------------------------------------------------
-- Credential / training expiry dashboards
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "employee_credentials_organizationId_expiryDate_idx"
  ON "hr"."employee_credentials"("organizationId", "expiryDate");

CREATE INDEX IF NOT EXISTS "employee_training_records_organizationId_expiryDate_idx"
  ON "hr"."employee_training_records"("organizationId", "expiryDate");

-- ---------------------------------------------------------------------------
-- Pay run list + period delete protection
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "pay_runs_organizationId_createdAt_idx"
  ON "payroll"."pay_runs"("organizationId", "createdAt");

ALTER TABLE "payroll"."pay_runs" DROP CONSTRAINT IF EXISTS "pay_runs_payrollPeriodId_fkey";

ALTER TABLE "payroll"."pay_runs"
  ADD CONSTRAINT "pay_runs_payrollPeriodId_fkey"
  FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll"."payroll_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Notification related-entity lookups (idempotency)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "notifications_relatedType_relatedId_idx"
  ON "notifications"."notifications"("relatedType", "relatedId");

-- ---------------------------------------------------------------------------
-- Audit trail org + time (and common filter compounds)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "audit_events_organizationId_createdAt_idx"
  ON "audit"."audit_events"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "audit_events_moduleKey_action_createdAt_idx"
  ON "audit"."audit_events"("moduleKey", "action", "createdAt");

CREATE INDEX IF NOT EXISTS "audit_events_entityType_entityId_createdAt_idx"
  ON "audit"."audit_events"("entityType", "entityId", "createdAt");

-- ---------------------------------------------------------------------------
-- Payslip statutory contribution columns (avoid snapshot JSON for YTD sums)
-- ---------------------------------------------------------------------------
ALTER TABLE "payroll"."payslips"
  ADD COLUMN IF NOT EXISTS "payeAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nisEmployeeAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "healthSurchargeAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0;
