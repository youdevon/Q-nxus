CREATE TYPE "payroll"."PayrollLineItemType" AS ENUM ('EARNING', 'DEDUCTION');

CREATE TYPE "payroll"."PayrollLineItemCode" AS ENUM (
  'CORRECTION_EARNING',
  'CORRECTION_DEDUCTION',
  'OVERTIME',
  'BONUS',
  'COMMISSION',
  'OTHER_EARNING',
  'OTHER_DEDUCTION'
);

CREATE TABLE "payroll"."payroll_line_items" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "payRunId" TEXT NOT NULL,
  "payslipId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "lineType" "payroll"."PayrollLineItemType" NOT NULL,
  "code" "payroll"."PayrollLineItemCode" NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "isTaxable" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_line_items_payRunId_idx" ON "payroll"."payroll_line_items"("payRunId");
CREATE INDEX "payroll_line_items_payslipId_idx" ON "payroll"."payroll_line_items"("payslipId");
CREATE INDEX "payroll_line_items_employeeId_idx" ON "payroll"."payroll_line_items"("employeeId");
CREATE INDEX "payroll_line_items_organizationId_createdAt_idx" ON "payroll"."payroll_line_items"("organizationId", "createdAt");

ALTER TABLE "payroll"."payroll_line_items"
  ADD CONSTRAINT "payroll_line_items_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_line_items"
  ADD CONSTRAINT "payroll_line_items_payRunId_fkey"
  FOREIGN KEY ("payRunId") REFERENCES "payroll"."pay_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_line_items"
  ADD CONSTRAINT "payroll_line_items_payslipId_fkey"
  FOREIGN KEY ("payslipId") REFERENCES "payroll"."payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_line_items"
  ADD CONSTRAINT "payroll_line_items_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
