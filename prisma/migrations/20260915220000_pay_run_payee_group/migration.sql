-- Separate regular pay runs by workforce category (employees vs board, etc.).
CREATE TYPE "payroll"."PayRunPayeeGroup" AS ENUM ('EMPLOYEE', 'BOARD', 'AGENT', 'CONTRACTOR');

ALTER TABLE "payroll"."pay_runs"
  ADD COLUMN "payeeGroup" "payroll"."PayRunPayeeGroup";

CREATE INDEX "pay_runs_organizationId_payeeGroup_idx"
  ON "payroll"."pay_runs"("organizationId", "payeeGroup");
