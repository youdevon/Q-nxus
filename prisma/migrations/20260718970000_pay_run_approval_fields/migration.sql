-- Maker-checker approval fields on pay runs (Wave B).
-- Cleared automatically whenever draft figures are recalculated.

ALTER TABLE "payroll"."pay_runs"
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalNote" TEXT;

CREATE INDEX IF NOT EXISTS "pay_runs_approvedById_idx"
  ON "payroll"."pay_runs"("approvedById");
