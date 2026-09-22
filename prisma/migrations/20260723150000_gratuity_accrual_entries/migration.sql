-- Monthly gratuity accrual journal entries (ops liability ledger).

CREATE TABLE "payroll"."gratuity_accrual_entries" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "settlementId" TEXT,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "periodKey" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TTD',
  "grossObligation" DECIMAL(14,2) NOT NULL,
  "accruedToDate" DECIMAL(14,2) NOT NULL,
  "periodAccrualAmount" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "gratuity_accrual_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gratuity_accrual_entries_contractId_periodYear_periodMonth_key"
  ON "payroll"."gratuity_accrual_entries"("contractId", "periodYear", "periodMonth");

CREATE INDEX "gratuity_accrual_entries_organizationId_periodYear_periodMonth_idx"
  ON "payroll"."gratuity_accrual_entries"("organizationId", "periodYear", "periodMonth");

CREATE INDEX "gratuity_accrual_entries_organizationId_periodKey_idx"
  ON "payroll"."gratuity_accrual_entries"("organizationId", "periodKey");

CREATE INDEX "gratuity_accrual_entries_employeeId_idx"
  ON "payroll"."gratuity_accrual_entries"("employeeId");

CREATE INDEX "gratuity_accrual_entries_settlementId_idx"
  ON "payroll"."gratuity_accrual_entries"("settlementId");

ALTER TABLE "payroll"."gratuity_accrual_entries"
  ADD CONSTRAINT "gratuity_accrual_entries_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."gratuity_accrual_entries"
  ADD CONSTRAINT "gratuity_accrual_entries_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."gratuity_accrual_entries"
  ADD CONSTRAINT "gratuity_accrual_entries_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "hr"."employment_contracts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."gratuity_accrual_entries"
  ADD CONSTRAINT "gratuity_accrual_entries_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "payroll"."employee_gratuity_settlements"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll"."gratuity_accrual_entries"
  ADD CONSTRAINT "gratuity_accrual_entries_postedByUserId_fkey"
  FOREIGN KEY ("postedByUserId") REFERENCES "core"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
