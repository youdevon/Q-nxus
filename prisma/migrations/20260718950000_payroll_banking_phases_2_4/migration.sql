-- Phase 2–4 payroll banking: payment snapshots, ACH batches, bank export profiles.

CREATE TYPE "payroll"."PayrollPaymentStatus" AS ENUM (
  'NOT_CONFIGURED',
  'PENDING',
  'PAYMENT_SETUP_REQUIRED',
  'PAYMENT_SETUP_ERROR',
  'READY',
  'INCLUDED_IN_BATCH',
  'PAID',
  'RECONCILED',
  'CANCELLED'
);

CREATE TYPE "payroll"."PayrollPaymentAllocationStatus" AS ENUM (
  'PENDING',
  'READY',
  'INCLUDED_IN_BATCH',
  'EXPORTED',
  'PAID',
  'RETURNED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "payroll"."AchPaymentBatchStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'GENERATED',
  'EXPORTED',
  'CANCELLED'
);

CREATE TYPE "payroll"."BankExportAdapterKind" AS ENUM (
  'MANUAL_REGISTER',
  'GENERIC_CSV'
);

CREATE TABLE "payroll"."payroll_payments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "payRunId" TEXT NOT NULL,
  "payslipId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "netPay" DECIMAL(14,2) NOT NULL,
  "allocatedAmount" DECIMAL(14,2) NOT NULL,
  "unallocatedAmount" DECIMAL(14,2) NOT NULL,
  "paymentMethod" "payroll"."PayrollPaymentMethod" NOT NULL,
  "paymentStatus" "payroll"."PayrollPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "setupErrorMessage" TEXT,
  "generatedAt" TIMESTAMP(3),
  "generatedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "paidAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_payments_payslipId_key"
  ON "payroll"."payroll_payments"("payslipId");

CREATE INDEX "payroll_payments_organizationId_payRunId_idx"
  ON "payroll"."payroll_payments"("organizationId", "payRunId");

CREATE INDEX "payroll_payments_payRunId_paymentStatus_idx"
  ON "payroll"."payroll_payments"("payRunId", "paymentStatus");

CREATE INDEX "payroll_payments_employeeId_idx"
  ON "payroll"."payroll_payments"("employeeId");

CREATE TABLE "payroll"."payroll_payment_allocations" (
  "id" TEXT NOT NULL,
  "payrollPaymentId" TEXT NOT NULL,
  "sourceAllocationId" TEXT,
  "employeeBankAccountId" TEXT,
  "financialInstitutionId" TEXT,
  "beneficiaryName" TEXT,
  "bankName" TEXT NOT NULL,
  "branchCode" TEXT,
  "branchName" TEXT,
  "accountType" "payroll"."BankAccountType",
  "accountNumberMasked" TEXT NOT NULL,
  "accountNumberEncrypted" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "allocationKind" TEXT NOT NULL,
  "status" "payroll"."PayrollPaymentAllocationStatus" NOT NULL DEFAULT 'PENDING',
  "returnCode" TEXT,
  "returnReason" TEXT,
  "returnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_payment_allocations_payrollPaymentId_sequence_idx"
  ON "payroll"."payroll_payment_allocations"("payrollPaymentId", "sequence");

CREATE INDEX "payroll_payment_allocations_employeeBankAccountId_idx"
  ON "payroll"."payroll_payment_allocations"("employeeBankAccountId");

CREATE INDEX "payroll_payment_allocations_financialInstitutionId_idx"
  ON "payroll"."payroll_payment_allocations"("financialInstitutionId");

CREATE INDEX "payroll_payment_allocations_status_idx"
  ON "payroll"."payroll_payment_allocations"("status");

CREATE TABLE "payroll"."bank_export_profiles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "adapterKind" "payroll"."BankExportAdapterKind" NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "configurationJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bank_export_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_export_profiles_organizationId_code_key"
  ON "payroll"."bank_export_profiles"("organizationId", "code");

CREATE INDEX "bank_export_profiles_organizationId_isActive_idx"
  ON "payroll"."bank_export_profiles"("organizationId", "isActive");

CREATE TABLE "payroll"."ach_payment_batches" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "payRunId" TEXT NOT NULL,
  "bankExportProfileId" TEXT NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "status" "payroll"."AchPaymentBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "controlTotalAmount" DECIMAL(14,2) NOT NULL,
  "detailCount" INTEGER NOT NULL DEFAULT 0,
  "fileName" TEXT,
  "fileStorageKey" TEXT,
  "fileContentHash" TEXT,
  "fileMimeType" TEXT,
  "preparedByUserId" TEXT,
  "preparedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "generatedAt" TIMESTAMP(3),
  "exportedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ach_payment_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ach_payment_batches_organizationId_batchNumber_key"
  ON "payroll"."ach_payment_batches"("organizationId", "batchNumber");

CREATE INDEX "ach_payment_batches_payRunId_status_idx"
  ON "payroll"."ach_payment_batches"("payRunId", "status");

CREATE INDEX "ach_payment_batches_organizationId_status_idx"
  ON "payroll"."ach_payment_batches"("organizationId", "status");

CREATE INDEX "ach_payment_batches_bankExportProfileId_idx"
  ON "payroll"."ach_payment_batches"("bankExportProfileId");

CREATE TABLE "payroll"."ach_payment_batch_details" (
  "id" TEXT NOT NULL,
  "achPaymentBatchId" TEXT NOT NULL,
  "payrollPaymentAllocationId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "amount" DECIMAL(14,2) NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'TTD',
  "employeeNumber" TEXT NOT NULL,
  "employeeName" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountNumberMasked" TEXT NOT NULL,
  "allocationKind" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ach_payment_batch_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ach_payment_batch_details_achPaymentBatchId_payrollPaymentAllocationId_key"
  ON "payroll"."ach_payment_batch_details"("achPaymentBatchId", "payrollPaymentAllocationId");

CREATE INDEX "ach_payment_batch_details_achPaymentBatchId_sequence_idx"
  ON "payroll"."ach_payment_batch_details"("achPaymentBatchId", "sequence");

ALTER TABLE "payroll"."payroll_payments"
  ADD CONSTRAINT "payroll_payments_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_payments"
  ADD CONSTRAINT "payroll_payments_payRunId_fkey"
  FOREIGN KEY ("payRunId") REFERENCES "payroll"."pay_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_payments"
  ADD CONSTRAINT "payroll_payments_payslipId_fkey"
  FOREIGN KEY ("payslipId") REFERENCES "payroll"."payslips"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_payments"
  ADD CONSTRAINT "payroll_payments_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_payment_allocations"
  ADD CONSTRAINT "payroll_payment_allocations_payrollPaymentId_fkey"
  FOREIGN KEY ("payrollPaymentId") REFERENCES "payroll"."payroll_payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_payment_allocations"
  ADD CONSTRAINT "payroll_payment_allocations_sourceAllocationId_fkey"
  FOREIGN KEY ("sourceAllocationId") REFERENCES "payroll"."employee_payroll_allocations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_payment_allocations"
  ADD CONSTRAINT "payroll_payment_allocations_employeeBankAccountId_fkey"
  FOREIGN KEY ("employeeBankAccountId") REFERENCES "payroll"."employee_bank_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll"."payroll_payment_allocations"
  ADD CONSTRAINT "payroll_payment_allocations_financialInstitutionId_fkey"
  FOREIGN KEY ("financialInstitutionId") REFERENCES "payroll"."financial_institutions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll"."bank_export_profiles"
  ADD CONSTRAINT "bank_export_profiles_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."ach_payment_batches"
  ADD CONSTRAINT "ach_payment_batches_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "core"."organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."ach_payment_batches"
  ADD CONSTRAINT "ach_payment_batches_payRunId_fkey"
  FOREIGN KEY ("payRunId") REFERENCES "payroll"."pay_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."ach_payment_batches"
  ADD CONSTRAINT "ach_payment_batches_bankExportProfileId_fkey"
  FOREIGN KEY ("bankExportProfileId") REFERENCES "payroll"."bank_export_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll"."ach_payment_batch_details"
  ADD CONSTRAINT "ach_payment_batch_details_achPaymentBatchId_fkey"
  FOREIGN KEY ("achPaymentBatchId") REFERENCES "payroll"."ach_payment_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll"."ach_payment_batch_details"
  ADD CONSTRAINT "ach_payment_batch_details_payrollPaymentAllocationId_fkey"
  FOREIGN KEY ("payrollPaymentAllocationId") REFERENCES "payroll"."payroll_payment_allocations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
