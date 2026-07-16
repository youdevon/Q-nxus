-- Correction / off-cycle pay runs (additional runs on an already-posted period)

CREATE TYPE "payroll"."PayRunKind" AS ENUM ('REGULAR', 'CORRECTION', 'OFF_CYCLE');

ALTER TABLE "payroll"."pay_runs"
  ADD COLUMN "runKind" "payroll"."PayRunKind" NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN "sourcePayRunId" TEXT;

CREATE INDEX "pay_runs_organizationId_runKind_idx"
  ON "payroll"."pay_runs"("organizationId", "runKind");

CREATE INDEX "pay_runs_sourcePayRunId_idx"
  ON "payroll"."pay_runs"("sourcePayRunId");

ALTER TABLE "payroll"."pay_runs"
  ADD CONSTRAINT "pay_runs_sourcePayRunId_fkey"
  FOREIGN KEY ("sourcePayRunId") REFERENCES "payroll"."pay_runs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
