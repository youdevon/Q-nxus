-- Payroll periods, pay runs, and posted payslip snapshots

CREATE TYPE "payroll"."PayrollPeriodStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "payroll"."PayRunStatus" AS ENUM ('DRAFT', 'POSTED');
CREATE TYPE "payroll"."PayslipRecordStatus" AS ENUM ('DRAFT', 'POSTED');

CREATE TABLE "payroll"."payroll_periods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "frequency" "payroll"."PayFrequency" NOT NULL DEFAULT 'MONTHLY',
    "periodKey" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "payroll"."PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_periods_organizationId_periodKey_frequency_key"
  ON "payroll"."payroll_periods"("organizationId", "periodKey", "frequency");

CREATE INDEX "payroll_periods_organizationId_year_month_idx"
  ON "payroll"."payroll_periods"("organizationId", "year", "month");

CREATE INDEX "payroll_periods_organizationId_status_idx"
  ON "payroll"."payroll_periods"("organizationId", "status");

CREATE TABLE "payroll"."pay_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "status" "payroll"."PayRunStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'TTD',
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pay_runs_organizationId_runNumber_key"
  ON "payroll"."pay_runs"("organizationId", "runNumber");

CREATE INDEX "pay_runs_payrollPeriodId_idx"
  ON "payroll"."pay_runs"("payrollPeriodId");

CREATE INDEX "pay_runs_organizationId_status_idx"
  ON "payroll"."pay_runs"("organizationId", "status");

CREATE TABLE "payroll"."payslips" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "payroll"."PayslipRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "grossPay" DECIMAL(14,2) NOT NULL,
    "totalDeductions" DECIMAL(14,2) NOT NULL,
    "netPay" DECIMAL(14,2) NOT NULL,
    "baseSalary" DECIMAL(14,2) NOT NULL,
    "allowancesTotal" DECIMAL(14,2) NOT NULL,
    "monthlyTaxableEarnings" DECIMAL(14,2) NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "nisNumber" TEXT,
    "birNumber" TEXT,
    "jobTitle" TEXT,
    "departmentName" TEXT,
    "payFrequency" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payslips_payRunId_employeeId_key"
  ON "payroll"."payslips"("payRunId", "employeeId");

CREATE INDEX "payslips_organizationId_employeeId_status_idx"
  ON "payroll"."payslips"("organizationId", "employeeId", "status");

CREATE INDEX "payslips_payrollPeriodId_idx"
  ON "payroll"."payslips"("payrollPeriodId");

CREATE INDEX "payslips_employeeId_status_createdAt_idx"
  ON "payroll"."payslips"("employeeId", "status", "createdAt");

ALTER TABLE "payroll"."payroll_periods"
  ADD CONSTRAINT "payroll_periods_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."pay_runs"
  ADD CONSTRAINT "pay_runs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."pay_runs"
  ADD CONSTRAINT "pay_runs_payrollPeriodId_fkey"
  FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll"."payroll_periods"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payslips"
  ADD CONSTRAINT "payslips_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payslips"
  ADD CONSTRAINT "payslips_payRunId_fkey"
  FOREIGN KEY ("payRunId") REFERENCES "payroll"."pay_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payslips"
  ADD CONSTRAINT "payslips_payrollPeriodId_fkey"
  FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll"."payroll_periods"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payslips"
  ADD CONSTRAINT "payslips_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
