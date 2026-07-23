import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import {
  deleteStoredFile,
  resolveStoredFileAbsolutePath,
  safeStoredFileName,
  UPLOADS_ROOT,
} from "@/src/lib/stored-file";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import {
  resolveBankExportAdapter,
  type BankExportDetailLine,
} from "@/src/modules/payroll/lib/bank-export-adapter";
import { decryptAccountNumber } from "@/src/modules/payroll/lib/bank-account-crypto";
import { sumMoney } from "@/src/modules/payroll/lib/money";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
  requiresVerifiedBankAccounts,
} from "@/src/modules/payroll/lib/payroll-banking-flags";

const ACH_STORAGE_PREFIX = "ach-exports";

export type AchBatchServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function money(value: { toString(): string }): number {
  return Number(value.toString());
}


async function nextBatchNumber(
  organizationId: string,
  payRunId: string,
): Promise<string> {
  const count = await prisma.achPaymentBatch.count({
    where: { organizationId, payRunId },
  });
  const run = await prisma.payRun.findUnique({
    where: { id: payRunId },
    select: { runNumber: true },
  });
  const seq = String(count + 1).padStart(3, "0");
  return `ACH-${run?.runNumber ?? payRunId.slice(0, 8)}-${seq}`;
}

async function storeAchExportFile(input: {
  batchId: string;
  fileName: string;
  content: string;
}): Promise<{ storageKey: string; contentHash: string }> {
  const safeName = safeStoredFileName(input.fileName);
  const storageKey = path.posix.join(
    ACH_STORAGE_PREFIX,
    input.batchId,
    `${Date.now()}-${safeName}`,
  );
  const absolutePath = resolveStoredFileAbsolutePath(
    storageKey,
    ACH_STORAGE_PREFIX,
  );
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.content, "utf8");
  const contentHash = createHash("sha256")
    .update(input.content, "utf8")
    .digest("hex");
  return { storageKey, contentHash };
}

export function resolveAchExportAbsolutePath(storageKey: string): string {
  return resolveStoredFileAbsolutePath(storageKey, ACH_STORAGE_PREFIX);
}

export async function deleteAchExportFile(storageKey: string): Promise<void> {
  return deleteStoredFile(storageKey, resolveAchExportAbsolutePath);
}

export async function createAchPaymentBatch(input: {
  payRunId: string;
  actorUserId: string;
  bankExportProfileId?: string | null;
  /** When ACH is disabled, create a MANUAL_REGISTER batch instead. */
  preferManualRegister?: boolean;
  audit?: AuditRequestMetadata;
}): Promise<
  AchBatchServiceResult<{
    batchId: string;
    batchNumber: string;
    status: string;
    detailCount: number;
    controlTotalAmount: number;
    adapterKind: string;
  }>
> {
  const achEnabled = await isPayrollBankingFeatureEnabled(
    PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED,
  );
  const approvalRequired = await isPayrollBankingFeatureEnabled(
    PAYROLL_BANKING_FEATURE_FLAGS.PAYMENT_BATCH_APPROVAL_REQUIRED,
  );

  if (!achEnabled && !input.preferManualRegister) {
    return {
      ok: false,
      error:
        "ACH export is disabled. Use Generate manual payment register, or enable ACH_EXPORT_ENABLED.",
    };
  }

  const run = await prisma.payRun.findUnique({
    where: { id: input.payRunId },
    include: {
      payrollPeriod: { select: { periodEnd: true, periodKey: true } },
      payrollPayments: {
        where: { paymentStatus: { in: ["READY", "INCLUDED_IN_BATCH"] } },
        include: {
          allocations: {
            where: { status: { in: ["READY", "PENDING"] } },
            orderBy: [{ sequence: "asc" }],
            include: {
              employeeBankAccount: {
                select: {
                  routingNumber: true,
                  accountType: true,
                  bankName: true,
                  financialInstitution: {
                    select: { displayName: true, routingCode: true },
                  },
                },
              },
            },
          },
          payslip: {
            select: { employeeNumber: true, employeeName: true },
          },
        },
      },
    },
  });

  if (!run || !isPayRunPosted(run.status)) {
    return { ok: false, error: "Posted pay run not found." };
  }

  if (run.payrollPayments.length === 0) {
    return {
      ok: false,
      error: "Prepare payments before creating a payment batch.",
    };
  }

  const [allowZeroNet, allowNegativeNet, requireVerified] = await Promise.all([
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_ZERO_NET_PAY_EXPORT,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_NEGATIVE_NET_PAY_EXPORT,
    ),
    requiresVerifiedBankAccounts(),
  ]);

  const eligiblePayments = run.payrollPayments.filter((payment) => {
    const net = Number(payment.netPay.toString());
    if (net < 0) {
      return allowNegativeNet;
    }
    if (net === 0) {
      return allowZeroNet;
    }
    return true;
  });

  if (requireVerified) {
    const accountIds = [
      ...new Set(
        eligiblePayments.flatMap((payment) =>
          payment.allocations
            .map((row) => row.employeeBankAccountId)
            .filter((id): id is string => id != null),
        ),
      ),
    ];
    if (accountIds.length > 0) {
      const unverifiedCount = await prisma.employeeBankAccount.count({
        where: {
          id: { in: accountIds },
          isVerified: false,
        },
      });
      if (unverifiedCount > 0) {
        return {
          ok: false,
          error:
            "Batch blocked: one or more allocations use unverified bank accounts. Verify accounts or enable ALLOW_UNVERIFIED_BANK_ACCOUNTS.",
        };
      }
    }
  }

  const readyAllocations = eligiblePayments.flatMap((payment) =>
    payment.allocations
      .filter((row) => Number(row.amount.toString()) > 0)
      .map((allocation) => ({
        payment,
        allocation,
      })),
  );

  if (readyAllocations.length === 0) {
    return {
      ok: false,
      error:
        "No bank payment allocations are ready. Cheque/cash-only runs use the manual register without ACH details.",
    };
  }

  const alreadyBatched = await prisma.achPaymentBatchDetail.findMany({
    where: {
      payrollPaymentAllocationId: {
        in: readyAllocations.map(({ allocation }) => allocation.id),
      },
      achPaymentBatch: { status: { not: "CANCELLED" } },
    },
    select: { payrollPaymentAllocationId: true },
  });
  const batchedIds = new Set(
    alreadyBatched.map((row) => row.payrollPaymentAllocationId),
  );
  const available = readyAllocations.filter(
    ({ allocation }) => !batchedIds.has(allocation.id),
  );

  if (available.length === 0) {
    return {
      ok: false,
      error: "All ready allocations are already included in a payment batch.",
    };
  }

  const preferManual = input.preferManualRegister === true || !achEnabled;
  const profile =
    input.bankExportProfileId != null
      ? await prisma.bankExportProfile.findFirst({
          where: {
            id: input.bankExportProfileId,
            organizationId: run.organizationId,
            isActive: true,
          },
        })
      : preferManual
        ? await prisma.bankExportProfile.findFirst({
            where: {
              organizationId: run.organizationId,
              isActive: true,
              adapterKind: {
                in: ["MANUAL_REGISTER", "FIRST_CITIZENS_MANUAL_WORKSHEET"],
              },
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          })
        : await prisma.bankExportProfile.findFirst({
            where: {
              organizationId: run.organizationId,
              isActive: true,
              adapterKind: {
                in: ["GENERIC_CSV", "FIRST_CITIZENS_MANUAL_WORKSHEET"],
              },
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          });

  if (!profile) {
    return {
      ok: false,
      error:
        "No active bank export profile found. Seed the default MANUAL_REGISTER / First Citizens worksheet profiles.",
    };
  }

  const manualSafeKinds = new Set([
    "MANUAL_REGISTER",
    "FIRST_CITIZENS_MANUAL_WORKSHEET",
  ]);
  if (!achEnabled && !manualSafeKinds.has(profile.adapterKind)) {
    return {
      ok: false,
      error:
        "ACH export is disabled — only MANUAL_REGISTER or First Citizens manual worksheet profiles can be used.",
    };
  }

  const batchNumber = await nextBatchNumber(run.organizationId, run.id);
  const controlTotalAmount = sumMoney(
    ...available.map((row) => money(row.allocation.amount)),
  );
  // Disbursement control total = sum of prepared allocation amounts (not Phase-1 netPay,
  // where FIXED secondaries can sit outside net while still being paid).
  const payrollDisbursementTotal = sumMoney(
    ...[
      ...new Map(
        available.map(({ payment }) => [
          payment.id,
          money(payment.allocatedAmount),
        ]),
      ).values(),
    ],
  );
  const payslipNetTotal = sumMoney(
    ...[
      ...new Map(
        available.map(({ payment }) => [payment.id, money(payment.netPay)]),
      ).values(),
    ],
  );
  const fcbConfig =
    profile.adapterKind === "FIRST_CITIZENS_MANUAL_WORKSHEET" ||
    profile.adapterKind === "FIRST_CITIZENS_IMPORT"
      ? (await import("@/src/modules/payroll/lib/first-citizens-export"))
          .parseFirstCitizensConfiguration(profile.configurationJson)
      : null;
  const { firstCitizensPaymentType } = await import(
    "@/src/modules/payroll/lib/payment-instructions"
  );
  const { buildPaymentReadinessSummary } = await import(
    "@/src/modules/payroll/lib/payment-readiness"
  );

  const readiness = buildPaymentReadinessSummary({
    payRunReference: run.runNumber,
    effectivePaymentDate: run.payrollPeriod.periodEnd
      .toISOString()
      .slice(0, 10),
    employeeCount: new Set(available.map(({ payment }) => payment.employeeId))
      .size,
    paymentEntryCount: available.length,
    payrollNetTotal: payrollDisbursementTotal,
    achBatchTotal: controlTotalAmount,
    issues:
      Math.abs(payrollDisbursementTotal - payslipNetTotal) > 0.009
        ? [
            {
              severity: "warning" as const,
              code: "PHASE1_NET_VS_DISBURSEMENT",
              message: `Payslip net total ${payslipNetTotal.toFixed(2)} differs from disbursement allocation total ${payrollDisbursementTotal.toFixed(2)} (expected when FIXED bank lines are Phase-1 deductions).`,
            },
          ]
        : [],
  });

  const initialStatus = !readiness.readyForApproval
    ? "VALIDATION_FAILED"
    : approvalRequired &&
        profile.adapterKind !== "MANUAL_REGISTER" &&
        profile.adapterKind !== "FIRST_CITIZENS_MANUAL_WORKSHEET"
      ? "PENDING_APPROVAL"
      : "READY_FOR_APPROVAL";
  const now = new Date();

  if (profile.adapterKind === "FIRST_CITIZENS_IMPORT") {
    return {
      ok: false,
      error:
        "First Citizens import file profile is disabled until the bank confirms the file layout. Use the First Citizens manual-entry worksheet instead.",
    };
  }

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.achPaymentBatch.create({
      data: {
        organizationId: run.organizationId,
        payRunId: run.id,
        bankExportProfileId: profile.id,
        batchNumber,
        status: initialStatus,
        currencyCode: run.currency,
        controlTotalAmount: new Prisma.Decimal(controlTotalAmount.toFixed(2)),
        payrollNetTotal: new Prisma.Decimal(payrollDisbursementTotal.toFixed(2)),
        detailCount: available.length,
        effectivePaymentDate: run.payrollPeriod.periodEnd,
        achType: fcbConfig?.achType ?? "PPD",
        purposeCode: fcbConfig?.defaultPurposeCode ?? null,
        entryDescription: fcbConfig?.entryDescription ?? null,
        globalAddenda: fcbConfig?.globalAddenda ?? null,
        discretionaryData: fcbConfig?.discretionaryData ?? null,
        transactionType: fcbConfig?.transactionType ?? "Credit",
        validationSummaryJson: readiness,
        preparedByUserId: input.actorUserId,
        preparedAt: now,
        details: {
          create: available.map(({ payment, allocation }, index) => {
            const bank = allocation.employeeBankAccount;
            const aba =
              bank?.routingNumber?.trim() ||
              bank?.financialInstitution?.routingCode?.trim() ||
              bank?.financialInstitution?.displayName ||
              allocation.bankName;
            return {
              payrollPaymentAllocationId: allocation.id,
              sequence: index + 1,
              amount: allocation.amount,
              currencyCode: allocation.currencyCode,
              employeeNumber: payment.payslip.employeeNumber,
              employeeName: payment.payslip.employeeName,
              individualId: payment.payslip.employeeNumber,
              bankName: allocation.bankName,
              abaNumber: aba,
              accountNumberMasked: allocation.accountNumberMasked,
              paymentType: firstCitizensPaymentType(
                bank?.accountType ?? allocation.accountType ?? "SAVINGS",
              ),
              purposeCode: fcbConfig?.defaultPurposeCode ?? null,
              addenda: fcbConfig?.globalAddenda ?? null,
              allocationKind: allocation.allocationKind,
            };
          }),
        },
      },
    });

    await tx.payrollPaymentAllocation.updateMany({
      where: { id: { in: available.map(({ allocation }) => allocation.id) } },
      data: { status: "INCLUDED_IN_BATCH" },
    });

    await tx.payrollPayment.updateMany({
      where: {
        id: { in: [...new Set(available.map(({ payment }) => payment.id))] },
      },
      data: { paymentStatus: "INCLUDED_IN_BATCH" },
    });

    return created;
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: run.organizationId,
    moduleKey: "payroll",
    action: "CREATE_PAYMENT_BATCH",
    entityType: "AchPaymentBatch",
    entityId: batch.id,
    description: `Created payment batch ${batch.batchNumber} (${available.length} details, ${controlTotalAmount.toFixed(2)} ${run.currency}).`,
    newValues: {
      batchNumber: batch.batchNumber,
      status: batch.status,
      adapterKind: profile.adapterKind,
      detailCount: available.length,
      controlTotalAmount,
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return {
    ok: true,
    data: {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      status: batch.status,
      detailCount: available.length,
      controlTotalAmount,
      adapterKind: profile.adapterKind,
    },
  };
}

export async function approveAchPaymentBatch(input: {
  batchId: string;
  actorUserId: string;
  audit?: AuditRequestMetadata;
}): Promise<AchBatchServiceResult<{ batchId: string; status: string }>> {
  const approvalRequired =
    (await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.PAYMENT_BATCH_APPROVAL_REQUIRED,
    )) ||
    (await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ACH_FILE_APPROVAL_REQUIRED,
    ));

  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: input.batchId },
  });

  if (!batch) {
    return { ok: false, error: "Payment batch not found." };
  }

  if (batch.status === "VALIDATION_FAILED") {
    return {
      ok: false,
      error:
        "Batch failed validation and cannot be approved. Cancel and regenerate after fixing payment instructions.",
    };
  }

  if (batch.status !== "PENDING_APPROVAL" && batch.status !== "DRAFT" && batch.status !== "READY_FOR_APPROVAL") {
    return {
      ok: false,
      error: `Batch ${batch.batchNumber} cannot be approved from status ${batch.status}.`,
    };
  }

  if (approvalRequired && batch.preparedByUserId === input.actorUserId) {
    const allowSelf = await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_BATCH_SELF_APPROVAL,
    );
    if (!allowSelf) {
      return {
        ok: false,
        error:
          "Maker-checker: the user who prepared this batch cannot approve it unless ALLOW_BATCH_SELF_APPROVAL is enabled.",
      };
    }
  }

  const updated = await prisma.achPaymentBatch.update({
    where: { id: batch.id },
    data: {
      status: "APPROVED",
      approvedByUserId: input.actorUserId,
      approvedAt: new Date(),
    },
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: batch.organizationId,
    moduleKey: "payroll",
    action: "APPROVE_PAYMENT_BATCH",
    entityType: "AchPaymentBatch",
    entityId: batch.id,
    description: `Approved payment batch ${batch.batchNumber}.`,
    oldValues: { status: batch.status },
    newValues: { status: updated.status },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return { ok: true, data: { batchId: updated.id, status: updated.status } };
}

export async function generateAchPaymentBatchFile(input: {
  batchId: string;
  actorUserId: string;
  runNumber: string;
  audit?: AuditRequestMetadata;
}): Promise<
  AchBatchServiceResult<{
    batchId: string;
    fileName: string;
    contentHash: string;
    controlTotalAmount: number;
    maskedPreview: string;
    status: string;
  }>
> {
  const achFileApprovalRequired = await isPayrollBankingFeatureEnabled(
    PAYROLL_BANKING_FEATURE_FLAGS.ACH_FILE_APPROVAL_REQUIRED,
  );
  const batchApprovalRequired = await isPayrollBankingFeatureEnabled(
    PAYROLL_BANKING_FEATURE_FLAGS.PAYMENT_BATCH_APPROVAL_REQUIRED,
  );

  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: input.batchId },
    include: {
      bankExportProfile: true,
      details: {
        orderBy: [{ sequence: "asc" }],
        include: {
          payrollPaymentAllocation: {
            select: {
              accountNumberEncrypted: true,
              beneficiaryName: true,
              branchCode: true,
              branchName: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    return { ok: false, error: "Payment batch not found." };
  }

  const isManual =
    batch.bankExportProfile.adapterKind === "MANUAL_REGISTER" ||
    batch.bankExportProfile.adapterKind === "FIRST_CITIZENS_MANUAL_WORKSHEET";
  const needsApproval = !isManual && (batchApprovalRequired || achFileApprovalRequired);

  if (needsApproval && batch.status !== "APPROVED") {
    return {
      ok: false,
      error:
        "This batch requires approval before generating an export file.",
    };
  }

  if (
    batch.status !== "DRAFT" &&
    batch.status !== "READY_FOR_APPROVAL" &&
    batch.status !== "APPROVED" &&
    batch.status !== "GENERATED" &&
    !(isManual && batch.status === "PENDING_APPROVAL")
  ) {
    return {
      ok: false,
      error: `Cannot generate file from batch status ${batch.status}.`,
    };
  }

  const details: BankExportDetailLine[] = batch.details.map((detail) => {
    let accountNumber: string | null = null;
    try {
      accountNumber = decryptAccountNumber(
        detail.payrollPaymentAllocation.accountNumberEncrypted,
      );
    } catch {
      accountNumber = null;
    }
    return {
      sequence: detail.sequence,
      employeeNumber: detail.employeeNumber,
      employeeName: detail.employeeName,
      bankName: detail.bankName,
      accountNumber,
      accountNumberMasked: detail.accountNumberMasked,
      amount: money(detail.amount),
      currencyCode: detail.currencyCode,
      allocationKind: detail.allocationKind,
      beneficiaryName: detail.payrollPaymentAllocation.beneficiaryName,
      branchCode: detail.payrollPaymentAllocation.branchCode,
      branchName: detail.payrollPaymentAllocation.branchName,
    };
  });

  const adapter = resolveBankExportAdapter(batch.bankExportProfile.adapterKind);
  const validation = adapter.validate({
    batchNumber: batch.batchNumber,
    runNumber: input.runNumber,
    currencyCode: batch.currencyCode,
    details,
    configurationJson: batch.bankExportProfile.configurationJson,
  });

  if (!validation.ok) {
    return { ok: false, error: validation.errors.join(" ") };
  }

  const generated = adapter.generate({
    batchNumber: batch.batchNumber,
    runNumber: input.runNumber,
    currencyCode: batch.currencyCode,
    details,
    configurationJson: batch.bankExportProfile.configurationJson,
  });

  if (
    Math.abs(generated.controlTotalAmount - money(batch.controlTotalAmount)) >
    0.001
  ) {
    return {
      ok: false,
      error: `Control total mismatch: file ${generated.controlTotalAmount.toFixed(2)} vs batch ${money(batch.controlTotalAmount).toFixed(2)}.`,
    };
  }

  const previousStorageKey = batch.fileStorageKey;

  const stored = await storeAchExportFile({
    batchId: batch.id,
    fileName: generated.fileName,
    content: generated.content,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.achPaymentBatch.update({
      where: { id: batch.id },
      data: {
        status: "GENERATED",
        fileName: generated.fileName,
        fileStorageKey: stored.storageKey,
        fileContentHash: stored.contentHash,
        fileMimeType: generated.mimeType,
        generatedAt: new Date(),
        controlTotalAmount: new Prisma.Decimal(
          generated.controlTotalAmount.toFixed(2),
        ),
        detailCount: generated.detailCount,
      },
    });

    await tx.payrollPaymentAllocation.updateMany({
      where: {
        id: {
          in: batch.details.map((detail) => detail.payrollPaymentAllocationId),
        },
      },
      data: { status: "EXPORTED" },
    });

    return row;
  });

  if (previousStorageKey && previousStorageKey !== stored.storageKey) {
    await deleteAchExportFile(previousStorageKey);
  }

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: batch.organizationId,
    moduleKey: "payroll",
    action: "GENERATE_PAYMENT_BATCH_FILE",
    entityType: "AchPaymentBatch",
    entityId: batch.id,
    description: `Generated export file for batch ${batch.batchNumber} (${generated.fileName}).`,
    newValues: {
      fileName: generated.fileName,
      contentHash: stored.contentHash,
      controlTotalAmount: generated.controlTotalAmount,
      detailCount: generated.detailCount,
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return {
    ok: true,
    data: {
      batchId: updated.id,
      fileName: generated.fileName,
      contentHash: stored.contentHash,
      controlTotalAmount: generated.controlTotalAmount,
      maskedPreview: generated.maskedPreview,
      status: updated.status,
    },
  };
}

/** Mark a generated batch as exported (download occurred). */
export async function markAchPaymentBatchExported(input: {
  batchId: string;
  actorUserId: string;
  audit?: AuditRequestMetadata;
}): Promise<void> {
  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: input.batchId },
  });
  if (!batch || batch.status !== "GENERATED") {
    return;
  }

  await prisma.achPaymentBatch.update({
    where: { id: batch.id },
    data: { status: "EXPORTED", exportedAt: new Date() },
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: batch.organizationId,
    moduleKey: "payroll",
    action: "EXPORT",
    entityType: "AchPaymentBatch",
    entityId: batch.id,
    description: `Downloaded payment batch file ${batch.batchNumber}.`,
    newValues: { exportKind: "ACH", fileName: batch.fileName },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });
}

export async function cancelAchPaymentBatch(input: {
  batchId: string;
  actorUserId: string;
  reason?: string | null;
  audit?: AuditRequestMetadata;
}): Promise<AchBatchServiceResult<{ batchId: string; status: string }>> {
  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: input.batchId },
    include: { details: { select: { payrollPaymentAllocationId: true } } },
  });
  if (!batch) {
    return { ok: false, error: "Payment batch not found." };
  }
  if (
    batch.status === "CANCELLED" ||
    batch.status === "RELEASED" ||
    batch.status === "RECONCILED"
  ) {
    return {
      ok: false,
      error: `Batch ${batch.batchNumber} cannot be cancelled from status ${batch.status}.`,
    };
  }

  const allocationIds = batch.details.map((d) => d.payrollPaymentAllocationId);
  await prisma.$transaction(async (tx) => {
    await tx.achPaymentBatch.update({
      where: { id: batch.id },
      data: {
        status: "CANCELLED",
        notes: input.reason
          ? [batch.notes, input.reason].filter(Boolean).join("\n")
          : batch.notes,
      },
    });
    if (allocationIds.length > 0) {
      await tx.payrollPaymentAllocation.updateMany({
        where: {
          id: { in: allocationIds },
          status: { in: ["INCLUDED_IN_BATCH", "EXPORTED"] },
        },
        data: { status: "READY" },
      });
    }
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: batch.organizationId,
    moduleKey: "payroll",
    action: "CANCEL_PAYMENT_BATCH",
    entityType: "AchPaymentBatch",
    entityId: batch.id,
    description: `Cancelled payment batch ${batch.batchNumber}.`,
    oldValues: { status: batch.status },
    newValues: { status: "CANCELLED", reason: input.reason ?? null },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return { ok: true, data: { batchId: batch.id, status: "CANCELLED" } };
}

export async function markAchPaymentBatchReleased(input: {
  batchId: string;
  actorUserId: string;
  audit?: AuditRequestMetadata;
}): Promise<AchBatchServiceResult<{ batchId: string; status: string }>> {
  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: input.batchId },
  });
  if (!batch) {
    return { ok: false, error: "Payment batch not found." };
  }
  if (batch.status !== "EXPORTED" && batch.status !== "GENERATED") {
    return {
      ok: false,
      error: `Batch must be exported before marking released (current: ${batch.status}).`,
    };
  }

  const updated = await prisma.achPaymentBatch.update({
    where: { id: batch.id },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
      releasedByUserId: input.actorUserId,
    },
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: batch.organizationId,
    moduleKey: "payroll",
    action: "RELEASE_PAYMENT_BATCH",
    entityType: "AchPaymentBatch",
    entityId: batch.id,
    description: `Marked payment batch ${batch.batchNumber} as released (bank portal confirmation).`,
    oldValues: { status: batch.status },
    newValues: { status: updated.status },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return { ok: true, data: { batchId: updated.id, status: updated.status } };
}

export async function markAchPaymentBatchReconciled(input: {
  batchId: string;
  actorUserId: string;
  audit?: AuditRequestMetadata;
}): Promise<AchBatchServiceResult<{ batchId: string; status: string }>> {
  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: input.batchId },
  });
  if (!batch) {
    return { ok: false, error: "Payment batch not found." };
  }
  if (batch.status !== "RELEASED" && batch.status !== "EXPORTED") {
    return {
      ok: false,
      error: `Batch must be released (or exported) before reconcile (current: ${batch.status}).`,
    };
  }

  const updated = await prisma.achPaymentBatch.update({
    where: { id: batch.id },
    data: {
      status: "RECONCILED",
      reconciledAt: new Date(),
      reconciledByUserId: input.actorUserId,
    },
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: batch.organizationId,
    moduleKey: "payroll",
    action: "RECONCILE_PAYMENT_BATCH",
    entityType: "AchPaymentBatch",
    entityId: batch.id,
    description: `Reconciled payment batch ${batch.batchNumber}.`,
    oldValues: { status: batch.status },
    newValues: { status: updated.status },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return { ok: true, data: { batchId: updated.id, status: updated.status } };
}

export { UPLOADS_ROOT };
