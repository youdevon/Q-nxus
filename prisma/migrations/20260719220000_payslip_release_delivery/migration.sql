-- Payslip release + email delivery tracking (Payroll Phase C)

CREATE TYPE "payroll"."PayslipEmailDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED',
  'SKIPPED'
);

ALTER TABLE "payroll"."payslips"
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "releasedById" TEXT,
  ADD COLUMN "emailDeliveryStatus" "payroll"."PayslipEmailDeliveryStatus";

CREATE INDEX "payslips_payRunId_releasedAt_idx"
  ON "payroll"."payslips"("payRunId", "releasedAt");
CREATE INDEX "payslips_employeeId_releasedAt_idx"
  ON "payroll"."payslips"("employeeId", "releasedAt");

-- Preserve self-service access for already-posted historical slips.
UPDATE "payroll"."payslips" AS p
SET
  "releasedAt" = COALESCE(pr."postedAt", p."createdAt"),
  "emailDeliveryStatus" = 'SKIPPED'
FROM "payroll"."pay_runs" AS pr
WHERE p."payRunId" = pr.id
  AND p.status = 'POSTED'
  AND p."releasedAt" IS NULL;
