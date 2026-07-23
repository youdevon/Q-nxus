import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { decryptAccountNumber } from "@/src/modules/payroll/lib/bank-account-crypto";
import { toPayslipBankAccountInputs } from "@/src/modules/payroll/lib/employee-bank-account-adapter";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
  requiresVerifiedBankAccounts,
} from "@/src/modules/payroll/lib/payroll-banking-flags";
import {
  applyFixedBankAllocations,
  type PayslipBankLine,
} from "@/src/modules/payroll/lib/payslip-preview";
import { applyPostNetBankAllocations } from "@/src/modules/payroll/lib/post-net-bank-allocations";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import { filterEffectiveBankSetup } from "@/src/modules/payroll/lib/effective-dated-banking";
import {
  buildPaymentDraftFromPayslip,
  summarizePreparedPayments,
  type PaymentBankAccountEnrichment,
  type PreparePaymentsSummary,
  type PreparedPaymentDraft,
} from "@/src/modules/payroll/lib/prepare-payroll-payments";

export type PreparePayrollPaymentsResult =
  | {
      ok: true;
      alreadyPrepared: boolean;
      summary: PreparePaymentsSummary;
      paymentIds: string[];
    }
  | { ok: false; error: string };

function money(value: { toString(): string }): number {
  return Number(value.toString());
}

function plaintextAccount(stored: string): string {
  try {
    return decryptAccountNumber(stored) ?? stored;
  } catch {
    return stored;
  }
}

function enrichmentFromEmployee(input: {
  accounts: Array<{
    id: string;
    financialInstitutionId: string | null;
    bankName: string;
    branchCode: string | null;
    branchName: string | null;
    accountHolderName: string | null;
    accountNumber: string;
    accountNumberLastFour: string;
    accountType: PaymentBankAccountEnrichment["accountType"];
    isVerified: boolean;
    allocations: Array<{ id: string; isActive: boolean }>;
  }>;
}): PaymentBankAccountEnrichment[] {
  return input.accounts.map((account) => ({
    id: account.id,
    financialInstitutionId: account.financialInstitutionId,
    bankName: account.bankName,
    branchCode: account.branchCode,
    branchName: account.branchName,
    accountHolderName: account.accountHolderName,
    accountNumber: plaintextAccount(account.accountNumber),
    accountNumberLastFour: account.accountNumberLastFour,
    accountType: account.accountType,
    isVerified: account.isVerified,
    sourceAllocationId:
      account.allocations.find((row) => row.isActive)?.id ?? null,
  }));
}

function fallbackDistributionForEmployee(input: {
  netPay: number;
  postNetSplitEnabled: boolean;
  accounts: Array<{
    id: string;
    bankName: string;
    branchName: string | null;
    accountNumber: string;
    accountHolderName: string | null;
    isPrimary: boolean;
    sortOrder: number;
    financialInstitutionId: string | null;
    allocations: Array<{
      employeeBankAccountId: string;
      allocationType: string;
      fixedAmount: Prisma.Decimal | null;
      percentage: Prisma.Decimal | null;
      receivesRemainder: boolean;
      isActive: boolean;
      priority: number;
    }>;
  }>;
}): PayslipBankLine[] | null {
  if (input.accounts.length === 0) {
    return null;
  }

  const decryptedAccounts = input.accounts.map((account) => ({
    ...account,
    accountNumber: plaintextAccount(account.accountNumber),
  }));

  if (input.postNetSplitEnabled) {
    const instructions = decryptedAccounts.flatMap((account) =>
      account.allocations
        .filter((row) => row.isActive)
        .map((row) => {
          const type = row.allocationType;
          const kind =
            type === "PERCENTAGE"
              ? ("PERCENTAGE" as const)
              : type === "FIXED_AMOUNT"
                ? ("FIXED" as const)
                : ("REMAINDER" as const);
          return {
            bankName: account.bankName,
            accountNumber: account.accountNumber,
            fixedAmount:
              kind === "FIXED" && row.fixedAmount != null
                ? Number(row.fixedAmount)
                : null,
            percentage:
              kind === "PERCENTAGE" && row.percentage != null
                ? Number(row.percentage)
                : null,
            kind,
            priority: row.priority,
          };
        }),
    );
    const resolved = applyPostNetBankAllocations({
      availableAfterStatutory: input.netPay,
      accounts: instructions,
    });
    return resolved.ok ? resolved.lines : null;
  }

  const allocations = decryptedAccounts.flatMap((account) =>
    account.allocations.map((row) => ({
      employeeBankAccountId: row.employeeBankAccountId,
      allocationType: row.allocationType,
      fixedAmount: row.fixedAmount == null ? null : Number(row.fixedAmount),
      percentage: row.percentage == null ? null : Number(row.percentage),
      receivesRemainder: row.receivesRemainder,
      isActive: row.isActive,
      priority: row.priority,
    })),
  );

  const payslipInputs = toPayslipBankAccountInputs({
    accounts: decryptedAccounts.map((account) => ({
      id: account.id,
      bankName: account.bankName,
      branchName: account.branchName,
      accountNumber: account.accountNumber,
      accountHolderName: account.accountHolderName,
      isPrimary: account.isPrimary,
      sortOrder: account.sortOrder,
      financialInstitutionId: account.financialInstitutionId,
    })),
    allocations,
  });

  if (payslipInputs.length === 0) {
    return null;
  }

  const { lines } = applyFixedBankAllocations({
    availableAfterStatutory: input.netPay,
    accounts: payslipInputs,
  });

  return lines;
}

async function persistPaymentDrafts(input: {
  organizationId: string;
  payRunId: string;
  drafts: PreparedPaymentDraft[];
  generatedByUserId: string;
}): Promise<string[]> {
  const paymentIds: string[] = [];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const draft of input.drafts) {
      const payment = await tx.payrollPayment.create({
        data: {
          organizationId: input.organizationId,
          payRunId: input.payRunId,
          payslipId: draft.payslipId,
          employeeId: draft.employeeId,
          netPay: new Prisma.Decimal(draft.netPay.toFixed(2)),
          allocatedAmount: new Prisma.Decimal(draft.allocatedAmount.toFixed(2)),
          unallocatedAmount: new Prisma.Decimal(
            draft.unallocatedAmount.toFixed(2),
          ),
          paymentMethod: draft.paymentMethod,
          paymentStatus: draft.paymentStatus,
          currencyCode: draft.currencyCode,
          setupErrorMessage: draft.setupErrorMessage,
          generatedAt: now,
          generatedByUserId: input.generatedByUserId,
          allocations: {
            create: draft.allocations.map((row) => ({
              sourceAllocationId: row.sourceAllocationId,
              employeeBankAccountId: row.employeeBankAccountId,
              financialInstitutionId: row.financialInstitutionId,
              beneficiaryName: row.beneficiaryName,
              bankName: row.bankName,
              branchCode: row.branchCode,
              branchName: row.branchName,
              accountType: row.accountType,
              accountNumberMasked: row.accountNumberMasked,
              accountNumberEncrypted: row.accountNumberEncrypted,
              amount: new Prisma.Decimal(row.amount.toFixed(2)),
              currencyCode: row.currencyCode,
              sequence: row.sequence,
              allocationKind: row.allocationKind,
              status: row.status,
            })),
          },
        },
        select: { id: true },
      });
      paymentIds.push(payment.id);
    }
  });

  return paymentIds;
}

/**
 * After a pay run is POSTED, freeze PayrollPayment + allocation snapshots.
 * Idempotent: if payments already exist, returns alreadyPrepared without mutation.
 */
export async function preparePayrollPaymentsForPayRun(input: {
  payRunId: string;
  actorUserId: string;
  audit?: AuditRequestMetadata;
}): Promise<PreparePayrollPaymentsResult> {
  const run = await prisma.payRun.findUnique({
    where: { id: input.payRunId },
    include: {
      payrollPeriod: { select: { periodEnd: true } },
      payslips: {
        where: { status: "POSTED" },
        orderBy: [{ employeeName: "asc" }],
      },
      payrollPayments: { select: { id: true } },
    },
  });

  if (!run) {
    return { ok: false, error: "Pay run not found." };
  }

  if (!isPayRunPosted(run.status)) {
    return {
      ok: false,
      error: "Prepare payments is only available after the pay run is posted.",
    };
  }

  if (run.payrollPayments.length > 0) {
    const existing = await prisma.payrollPayment.findMany({
      where: { payRunId: run.id },
      select: { id: true, paymentStatus: true, allocatedAmount: true },
    });
    return {
      ok: true,
      alreadyPrepared: true,
      summary: {
        paymentCount: existing.length,
        readyCount: existing.filter((row) => row.paymentStatus === "READY")
          .length,
        setupRequiredCount: existing.filter(
          (row) => row.paymentStatus === "PAYMENT_SETUP_REQUIRED",
        ).length,
        notConfiguredCount: existing.filter(
          (row) => row.paymentStatus === "NOT_CONFIGURED",
        ).length,
        errorCount: existing.filter(
          (row) => row.paymentStatus === "PAYMENT_SETUP_ERROR",
        ).length,
        totalAllocated: existing.reduce(
          (sum, row) => sum + money(row.allocatedAmount),
          0,
        ),
      },
      paymentIds: existing.map((row) => row.id),
    };
  }

  const bankingEnabled = await isPayrollBankingFeatureEnabled(
    PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED,
  );
  const postNetSplitEnabled = await isPayrollBankingFeatureEnabled(
    PAYROLL_BANKING_FEATURE_FLAGS.POST_NET_SPLIT_ENABLED,
  );
  const requireVerifiedAccounts = await requiresVerifiedBankAccounts();

  const employeeIds = [...new Set(run.payslips.map((slip) => slip.employeeId))];
  const asOf = run.payrollPeriod?.periodEnd ?? new Date();
  const bankAccountsRaw = await prisma.employeeBankAccount.findMany({
    where: {
      organizationId: run.organizationId,
      employeeId: { in: employeeIds },
      isActive: true,
      archivedAt: null,
    },
    include: {
      allocations: {
        where: { isActive: true },
        orderBy: [{ priority: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }],
  });

  const bankAccounts = filterEffectiveBankSetup(bankAccountsRaw, asOf);

  const accountsByEmployee = new Map<string, typeof bankAccounts>();
  for (const account of bankAccounts) {
    const list = accountsByEmployee.get(account.employeeId) ?? [];
    list.push(account);
    accountsByEmployee.set(account.employeeId, list);
  }

  const drafts: PreparedPaymentDraft[] = [];

  for (const slip of run.payslips) {
    const snapshot = parsePayslipSnapshot(slip.snapshot);
    const employeeAccounts = accountsByEmployee.get(slip.employeeId) ?? [];
    const enrichment = enrichmentFromEmployee({ accounts: employeeAccounts });
    const fallback =
      snapshot?.payslip.bankDistribution == null
        ? fallbackDistributionForEmployee({
            netPay: money(slip.netPay),
            postNetSplitEnabled,
            accounts: employeeAccounts,
          })
        : null;

    drafts.push(
      buildPaymentDraftFromPayslip({
        payslipId: slip.id,
        employeeId: slip.employeeId,
        netPay: money(slip.netPay),
        currencyCode: slip.currency,
        paymentMethod: slip.paymentMethod,
        payslip: snapshot?.payslip ?? null,
        bankingEnabled,
        bankAccounts: enrichment,
        fallbackDistribution: fallback,
        requireVerifiedAccounts,
      }),
    );
  }

  let paymentIds: string[];
  try {
    paymentIds = await persistPaymentDrafts({
      organizationId: run.organizationId,
      payRunId: run.id,
      drafts,
      generatedByUserId: input.actorUserId,
    });
  } catch (error) {
    // Concurrent prepare race: unique payslipId — treat as already prepared.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.payrollPayment.findMany({
        where: { payRunId: run.id },
        select: { id: true, paymentStatus: true, allocatedAmount: true },
      });
      if (existing.length > 0) {
        return {
          ok: true,
          alreadyPrepared: true,
          summary: {
            paymentCount: existing.length,
            readyCount: existing.filter((row) => row.paymentStatus === "READY")
              .length,
            setupRequiredCount: existing.filter(
              (row) => row.paymentStatus === "PAYMENT_SETUP_REQUIRED",
            ).length,
            notConfiguredCount: existing.filter(
              (row) => row.paymentStatus === "NOT_CONFIGURED",
            ).length,
            errorCount: existing.filter(
              (row) => row.paymentStatus === "PAYMENT_SETUP_ERROR",
            ).length,
            totalAllocated: existing.reduce(
              (sum, row) => sum + money(row.allocatedAmount),
              0,
            ),
          },
          paymentIds: existing.map((row) => row.id),
        };
      }
    }
    throw error;
  }

  const summary = summarizePreparedPayments(drafts);

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: run.organizationId,
    moduleKey: "payroll",
    action: "PREPARE_PAYMENTS",
    entityType: "PayRun",
    entityId: run.id,
    description: `Prepared ${summary.paymentCount} payroll payment${summary.paymentCount === 1 ? "" : "s"} for pay run ${run.runNumber} (${summary.readyCount} ready).`,
    newValues: {
      ...summary,
      bankingEnabled,
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return {
    ok: true,
    alreadyPrepared: false,
    summary,
    paymentIds,
  };
}
