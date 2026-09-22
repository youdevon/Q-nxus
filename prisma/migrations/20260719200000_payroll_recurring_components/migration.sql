-- Recurring earning/deduction masters with optional declining balances (Payroll Phase A)

CREATE TYPE "payroll"."PayrollComponentKind" AS ENUM ('EARNING', 'DEDUCTION');

CREATE TYPE "payroll"."PayrollComponentCategory" AS ENUM (
  'LOAN',
  'GARNISHMENT',
  'PENSION_INSTALLMENT',
  'VOLUNTARY_DEDUCTION',
  'RECURRING_EARNING'
);

CREATE TABLE "payroll"."payroll_component_definitions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "payroll"."PayrollComponentKind" NOT NULL,
  "category" "payroll"."PayrollComponentCategory" NOT NULL,
  "isTaxable" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "defaultAmount" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_component_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_component_definitions_organizationId_code_key"
  ON "payroll"."payroll_component_definitions"("organizationId", "code");
CREATE INDEX "payroll_component_definitions_organizationId_isActive_idx"
  ON "payroll"."payroll_component_definitions"("organizationId", "isActive");
CREATE INDEX "payroll_component_definitions_organizationId_kind_isActive_idx"
  ON "payroll"."payroll_component_definitions"("organizationId", "kind", "isActive");

ALTER TABLE "payroll"."payroll_component_definitions"
  ADD CONSTRAINT "payroll_component_definitions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll"."employee_payroll_recurring_items" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "remainingBalance" DECIMAL(14,2),
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_payroll_recurring_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_payroll_recurring_items_employeeId_isActive_idx"
  ON "payroll"."employee_payroll_recurring_items"("employeeId", "isActive");
CREATE INDEX "employee_payroll_recurring_items_organizationId_employeeId_idx"
  ON "payroll"."employee_payroll_recurring_items"("organizationId", "employeeId");
CREATE INDEX "employee_payroll_recurring_items_definitionId_idx"
  ON "payroll"."employee_payroll_recurring_items"("definitionId");
CREATE INDEX "employee_payroll_recurring_items_organizationId_isActive_startDate_idx"
  ON "payroll"."employee_payroll_recurring_items"("organizationId", "isActive", "startDate");

ALTER TABLE "payroll"."employee_payroll_recurring_items"
  ADD CONSTRAINT "employee_payroll_recurring_items_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll"."employee_payroll_recurring_items"
  ADD CONSTRAINT "employee_payroll_recurring_items_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll"."employee_payroll_recurring_items"
  ADD CONSTRAINT "employee_payroll_recurring_items_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "payroll"."payroll_component_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll"."employee_payroll_recurring_items"
  ADD CONSTRAINT "employee_payroll_recurring_items_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
