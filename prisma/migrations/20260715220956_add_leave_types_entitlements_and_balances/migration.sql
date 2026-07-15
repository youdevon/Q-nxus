-- CreateEnum
CREATE TYPE "hr"."LeaveUnit" AS ENUM ('DAYS', 'HOURS');

-- CreateEnum
CREATE TYPE "hr"."LeaveAccrualMethod" AS ENUM ('ANNUAL_GRANT', 'MONTHLY', 'PER_PAY_PERIOD', 'MANUAL', 'NONE');

-- CreateEnum
CREATE TYPE "hr"."LeaveBalanceTransactionType" AS ENUM ('OPENING_BALANCE', 'ENTITLEMENT', 'ACCRUAL', 'CARRY_FORWARD', 'REQUEST_RESERVED', 'REQUEST_RELEASED', 'LEAVE_TAKEN', 'ADJUSTMENT', 'EXPIRY', 'REVERSAL');

-- CreateEnum
CREATE TYPE "hr"."LeaveRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "hr"."LeaveApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "hr"."leave_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" "hr"."LeaveUnit" NOT NULL DEFAULT 'DAYS',
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "requiresBalance" BOOLEAN NOT NULL DEFAULT true,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "documentRequiredAfter" DECIMAL(7,2),
    "minimumNoticeDays" INTEGER NOT NULL DEFAULT 0,
    "maximumConsecutiveDays" DECIMAL(7,2),
    "allowsHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "allowsNegativeBalance" BOOLEAN NOT NULL DEFAULT false,
    "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
    "carryForwardLimit" DECIMAL(9,2),
    "carryForwardExpiryDays" INTEGER,
    "colour" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."leave_entitlement_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employmentType" "hr"."EmploymentType",
    "minimumServiceMonths" INTEGER NOT NULL DEFAULT 0,
    "maximumServiceMonths" INTEGER,
    "annualEntitlement" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "accrualMethod" "hr"."LeaveAccrualMethod" NOT NULL DEFAULT 'ANNUAL_GRANT',
    "accrualAmount" DECIMAL(9,4),
    "maximumBalance" DECIMAL(9,2),
    "prorateFirstYear" BOOLEAN NOT NULL DEFAULT true,
    "prorateFinalYear" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_entitlement_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_leave_balances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "leaveYear" INTEGER NOT NULL,
    "openingBalance" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "entitlement" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "carriedForward" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "adjustments" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "taken" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "expired" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."leave_balance_transactions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "leaveBalanceId" TEXT,
    "transactionType" "hr"."LeaveBalanceTransactionType" NOT NULL,
    "quantity" DECIMAL(9,2) NOT NULL,
    "balanceBefore" DECIMAL(9,2),
    "balanceAfter" DECIMAL(9,2),
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_types_organizationId_isActive_idx" ON "hr"."leave_types"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "leave_types_sortOrder_idx" ON "hr"."leave_types"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_organizationId_code_key" ON "hr"."leave_types"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_organizationId_name_key" ON "hr"."leave_types"("organizationId", "name");

-- CreateIndex
CREATE INDEX "leave_entitlement_rules_organizationId_idx" ON "hr"."leave_entitlement_rules"("organizationId");

-- CreateIndex
CREATE INDEX "leave_entitlement_rules_leaveTypeId_idx" ON "hr"."leave_entitlement_rules"("leaveTypeId");

-- CreateIndex
CREATE INDEX "leave_entitlement_rules_employmentType_idx" ON "hr"."leave_entitlement_rules"("employmentType");

-- CreateIndex
CREATE INDEX "leave_entitlement_rules_effectiveFrom_effectiveTo_idx" ON "hr"."leave_entitlement_rules"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "leave_entitlement_rules_priority_idx" ON "hr"."leave_entitlement_rules"("priority");

-- CreateIndex
CREATE INDEX "employee_leave_balances_employeeId_leaveYear_idx" ON "hr"."employee_leave_balances"("employeeId", "leaveYear");

-- CreateIndex
CREATE INDEX "employee_leave_balances_leaveTypeId_leaveYear_idx" ON "hr"."employee_leave_balances"("leaveTypeId", "leaveYear");

-- CreateIndex
CREATE INDEX "employee_leave_balances_availableBalance_idx" ON "hr"."employee_leave_balances"("availableBalance");

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_balances_employeeId_leaveTypeId_leaveYear_key" ON "hr"."employee_leave_balances"("employeeId", "leaveTypeId", "leaveYear");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_employeeId_idx" ON "hr"."leave_balance_transactions"("employeeId");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_leaveTypeId_idx" ON "hr"."leave_balance_transactions"("leaveTypeId");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_leaveBalanceId_idx" ON "hr"."leave_balance_transactions"("leaveBalanceId");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_transactionType_idx" ON "hr"."leave_balance_transactions"("transactionType");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_effectiveDate_idx" ON "hr"."leave_balance_transactions"("effectiveDate");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_referenceType_referenceId_idx" ON "hr"."leave_balance_transactions"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_createdByUserId_idx" ON "hr"."leave_balance_transactions"("createdByUserId");

-- AddForeignKey
ALTER TABLE "hr"."leave_types" ADD CONSTRAINT "leave_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_entitlement_rules" ADD CONSTRAINT "leave_entitlement_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_entitlement_rules" ADD CONSTRAINT "leave_entitlement_rules_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hr"."leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hr"."leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "hr"."leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_leaveBalanceId_fkey" FOREIGN KEY ("leaveBalanceId") REFERENCES "hr"."employee_leave_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "core"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
