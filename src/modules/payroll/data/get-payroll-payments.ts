import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/src/lib/format";
import type { PayRunLifecycleStatus } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";

function money(value: { toString(): string }): number {
  return Number(value.toString());
}

export type PayRunPaymentSummary = {
  prepared: boolean;
  paymentCount: number;
  readyCount: number;
  setupRequiredCount: number;
  notConfiguredCount: number;
  errorCount: number;
  includedInBatchCount: number;
  totalAllocatedLabel: string;
  statuses: Array<{ status: string; count: number }>;
};

export type PayRunPaymentBatchListItem = {
  id: string;
  batchNumber: string;
  status: string;
  adapterKind: string;
  profileName: string;
  isPlaceholder: boolean;
  detailCount: number;
  controlTotalLabel: string;
  fileName: string | null;
  hasDownload: boolean;
  preparedAt: string | null;
  approvedAt: string | null;
  generatedAt: string | null;
  viewHref: string;
  downloadHref: string | null;
  fcbWorksheetHref: string;
};

export type PayRunPaymentsPageData = {
  payRunId: string;
  runNumber: string;
  currency: string;
  status: PayRunLifecycleStatus;
  paymentSummary: PayRunPaymentSummary;
  batches: PayRunPaymentBatchListItem[];
  payments: Array<{
    id: string;
    employeeNumber: string;
    employeeName: string;
    paymentMethod: string;
    paymentStatus: string;
    netPayLabel: string;
    allocatedLabel: string;
    allocationCount: number;
    setupErrorMessage: string | null;
  }>;
  flags: {
    bankingEnabled: boolean;
    achExportEnabled: boolean;
    manualPaymentEnabled: boolean;
    paymentBatchApprovalRequired: boolean;
    achFileApprovalRequired: boolean;
    allowBatchSelfApproval: boolean;
  };
  exportProfiles: Array<{
    id: string;
    code: string;
    name: string;
    adapterKind: string;
    isDefault: boolean;
    isPlaceholder: boolean;
  }>;
};

export type AchPaymentBatchDetailData = {
  id: string;
  batchNumber: string;
  status: string;
  currencyCode: string;
  controlTotalLabel: string;
  payrollNetTotalLabel: string | null;
  detailCount: number;
  fileName: string | null;
  fileContentHash: string | null;
  hasDownload: boolean;
  downloadHref: string | null;
  fcbWorksheetHref: string;
  validationSummary: unknown;
  preparedByUserId: string | null;
  approvedByUserId: string | null;
  preparedAt: string | null;
  approvedAt: string | null;
  generatedAt: string | null;
  exportedAt: string | null;
  releasedAt: string | null;
  reconciledAt: string | null;
  profile: {
    id: string;
    code: string;
    name: string;
    adapterKind: string;
    isPlaceholder: boolean;
  };
  payRun: {
    id: string;
    runNumber: string;
  };
  details: Array<{
    id: string;
    sequence: number;
    employeeNumber: string;
    employeeName: string;
    bankName: string;
    accountNumberMasked: string;
    allocationKind: string;
    amountLabel: string;
    allocationId: string;
    allocationStatus: string;
    returnCode: string | null;
    returnReason: string | null;
    returnedAmountLabel: string | null;
    settledAt: string | null;
    resolutionNote: string | null;
  }>;
  canApprove: boolean;
  canGenerate: boolean;
  canCancel: boolean;
  canRelease: boolean;
  canReconcile: boolean;
  approvalBlockedReason: string | null;
  importFileDisabled: boolean;
  importDisabledReason: string | null;
};

export async function getPayRunPaymentFlags() {
  const [
    bankingEnabled,
    achExportEnabled,
    manualPaymentEnabled,
    paymentBatchApprovalRequired,
    achFileApprovalRequired,
    allowBatchSelfApproval,
  ] = await Promise.all([
    isPayrollBankingFeatureEnabled(PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED),
    isPayrollBankingFeatureEnabled(PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED),
    isPayrollBankingFeatureEnabled(PAYROLL_BANKING_FEATURE_FLAGS.MANUAL_PAYMENT_ENABLED),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.PAYMENT_BATCH_APPROVAL_REQUIRED,
    ),
    isPayrollBankingFeatureEnabled(PAYROLL_BANKING_FEATURE_FLAGS.ACH_FILE_APPROVAL_REQUIRED),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_BATCH_SELF_APPROVAL,
    ),
  ]);

  return {
    bankingEnabled,
    achExportEnabled,
    manualPaymentEnabled,
    paymentBatchApprovalRequired,
    achFileApprovalRequired,
    allowBatchSelfApproval,
  };
}

export async function getPayRunPaymentsPage(
  payRunId: string,
): Promise<PayRunPaymentsPageData | null> {
  const run = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payrollPayments: {
        include: {
          allocations: { select: { id: true } },
          payslip: {
            select: { employeeNumber: true, employeeName: true },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      achPaymentBatches: {
        include: {
          bankExportProfile: {
            select: {
              name: true,
              adapterKind: true,
              isPlaceholder: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });

  if (!run) {
    return null;
  }

  const [flags, exportProfiles] = await Promise.all([
    getPayRunPaymentFlags(),
    prisma.bankExportProfile.findMany({
      where: { organizationId: run.organizationId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        adapterKind: true,
        isDefault: true,
        isPlaceholder: true,
      },
    }),
  ]);

  const statusCounts = new Map<string, number>();
  for (const payment of run.payrollPayments) {
    statusCounts.set(
      payment.paymentStatus,
      (statusCounts.get(payment.paymentStatus) ?? 0) + 1,
    );
  }

  const totalAllocated = run.payrollPayments.reduce(
    (sum, row) => sum + money(row.allocatedAmount),
    0,
  );

  return {
    payRunId: run.id,
    runNumber: run.runNumber,
    currency: run.currency,
    status: run.status,
    paymentSummary: {
      prepared: run.payrollPayments.length > 0,
      paymentCount: run.payrollPayments.length,
      readyCount: statusCounts.get("READY") ?? 0,
      setupRequiredCount: statusCounts.get("PAYMENT_SETUP_REQUIRED") ?? 0,
      notConfiguredCount: statusCounts.get("NOT_CONFIGURED") ?? 0,
      errorCount: statusCounts.get("PAYMENT_SETUP_ERROR") ?? 0,
      includedInBatchCount: statusCounts.get("INCLUDED_IN_BATCH") ?? 0,
      totalAllocatedLabel: formatMoney(totalAllocated, {
        currency: run.currency,
      }),
      statuses: [...statusCounts.entries()].map(([status, count]) => ({
        status,
        count,
      })),
    },
    batches: run.achPaymentBatches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      status: batch.status,
      adapterKind: batch.bankExportProfile.adapterKind,
      profileName: batch.bankExportProfile.name,
      isPlaceholder: batch.bankExportProfile.isPlaceholder,
      detailCount: batch.detailCount,
      controlTotalLabel: formatMoney(money(batch.controlTotalAmount), {
        currency: batch.currencyCode,
      }),
      fileName: batch.fileName,
      hasDownload: Boolean(batch.fileStorageKey),
      preparedAt: batch.preparedAt?.toISOString() ?? null,
      approvedAt: batch.approvedAt?.toISOString() ?? null,
      generatedAt: batch.generatedAt?.toISOString() ?? null,
      viewHref: `/payroll/runs/${run.id}/payments/${batch.id}`,
      downloadHref: batch.fileStorageKey
        ? `/payroll/runs/${run.id}/payments/${batch.id}/download`
        : null,
      fcbWorksheetHref: `/payroll/runs/${run.id}/payments/${batch.id}/fcb-worksheet`,
    })),
    payments: run.payrollPayments.map((payment) => ({
      id: payment.id,
      employeeNumber: payment.payslip.employeeNumber,
      employeeName: payment.payslip.employeeName,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      netPayLabel: formatMoney(money(payment.netPay), {
        currency: payment.currencyCode,
      }),
      allocatedLabel: formatMoney(money(payment.allocatedAmount), {
        currency: payment.currencyCode,
      }),
      allocationCount: payment.allocations.length,
      setupErrorMessage: payment.setupErrorMessage,
    })),
    flags,
    exportProfiles,
  };
}

export async function getAchPaymentBatchDetail(
  payRunId: string,
  batchId: string,
  actorUserId: string | null,
): Promise<AchPaymentBatchDetailData | null> {
  const batch = await prisma.achPaymentBatch.findFirst({
    where: { id: batchId, payRunId },
    include: {
      bankExportProfile: true,
      payRun: { select: { id: true, runNumber: true } },
      details: {
        orderBy: [{ sequence: "asc" }],
        include: {
          payrollPaymentAllocation: {
            select: {
              id: true,
              status: true,
              returnCode: true,
              returnReason: true,
              returnedAmount: true,
              settledAt: true,
              resolutionNote: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    return null;
  }

  const flags = await getPayRunPaymentFlags();
  const isManual =
    batch.bankExportProfile.adapterKind === "MANUAL_REGISTER" ||
    batch.bankExportProfile.adapterKind === "FIRST_CITIZENS_MANUAL_WORKSHEET";
  const approvalRequired =
    !isManual &&
    (flags.paymentBatchApprovalRequired || flags.achFileApprovalRequired);
  const selfApprovalBlocked =
    approvalRequired &&
    Boolean(actorUserId) &&
    batch.preparedByUserId === actorUserId &&
    !flags.allowBatchSelfApproval;

  const canApprove =
    Boolean(actorUserId) &&
    (batch.status === "PENDING_APPROVAL" ||
      batch.status === "READY_FOR_APPROVAL" ||
      (batch.status === "DRAFT" && approvalRequired)) &&
    !selfApprovalBlocked;

  const canGenerate =
    batch.status === "APPROVED" ||
    batch.status === "GENERATED" ||
    batch.status === "READY_FOR_APPROVAL" ||
    (batch.status === "DRAFT" && (!approvalRequired || isManual));

  const canCancel = !["CANCELLED", "RELEASED", "RECONCILED"].includes(
    batch.status,
  );
  const canRelease =
    batch.status === "EXPORTED" || batch.status === "GENERATED";
  const canReconcile =
    batch.status === "RELEASED" || batch.status === "EXPORTED";

  const { parseFirstCitizensConfiguration } = await import(
    "@/src/modules/payroll/lib/first-citizens-export"
  );
  const fcbConfig = parseFirstCitizensConfiguration(
    batch.bankExportProfile.configurationJson,
  );
  const isFcbProfile =
    batch.bankExportProfile.adapterKind === "FIRST_CITIZENS_IMPORT" ||
    batch.bankExportProfile.adapterKind === "FIRST_CITIZENS_MANUAL_WORKSHEET";

  return {
    id: batch.id,
    batchNumber: batch.batchNumber,
    status: batch.status,
    currencyCode: batch.currencyCode,
    controlTotalLabel: formatMoney(money(batch.controlTotalAmount), {
      currency: batch.currencyCode,
    }),
    payrollNetTotalLabel:
      batch.payrollNetTotal != null
        ? formatMoney(money(batch.payrollNetTotal), {
            currency: batch.currencyCode,
          })
        : null,
    detailCount: batch.detailCount,
    fileName: batch.fileName,
    fileContentHash: batch.fileContentHash,
    hasDownload: Boolean(batch.fileStorageKey),
    downloadHref: batch.fileStorageKey
      ? `/payroll/runs/${payRunId}/payments/${batch.id}/download`
      : null,
    fcbWorksheetHref: `/payroll/runs/${payRunId}/payments/${batch.id}/fcb-worksheet`,
    validationSummary: batch.validationSummaryJson,
    preparedByUserId: batch.preparedByUserId,
    approvedByUserId: batch.approvedByUserId,
    preparedAt: batch.preparedAt?.toISOString() ?? null,
    approvedAt: batch.approvedAt?.toISOString() ?? null,
    generatedAt: batch.generatedAt?.toISOString() ?? null,
    exportedAt: batch.exportedAt?.toISOString() ?? null,
    releasedAt: batch.releasedAt?.toISOString() ?? null,
    reconciledAt: batch.reconciledAt?.toISOString() ?? null,
    profile: {
      id: batch.bankExportProfile.id,
      code: batch.bankExportProfile.code,
      name: batch.bankExportProfile.name,
      adapterKind: batch.bankExportProfile.adapterKind,
      isPlaceholder: batch.bankExportProfile.isPlaceholder,
    },
    payRun: {
      id: batch.payRun.id,
      runNumber: batch.payRun.runNumber,
    },
    details: batch.details.map((detail) => ({
      id: detail.id,
      sequence: detail.sequence,
      employeeNumber: detail.employeeNumber,
      employeeName: detail.employeeName,
      bankName: detail.bankName,
      accountNumberMasked: detail.accountNumberMasked,
      allocationKind: detail.allocationKind,
      amountLabel: formatMoney(money(detail.amount), {
        currency: detail.currencyCode,
      }),
      allocationId: detail.payrollPaymentAllocation.id,
      allocationStatus: detail.payrollPaymentAllocation.status,
      returnCode: detail.payrollPaymentAllocation.returnCode,
      returnReason: detail.payrollPaymentAllocation.returnReason,
      returnedAmountLabel:
        detail.payrollPaymentAllocation.returnedAmount != null
          ? formatMoney(money(detail.payrollPaymentAllocation.returnedAmount), {
              currency: detail.currencyCode,
            })
          : null,
      settledAt:
        detail.payrollPaymentAllocation.settledAt?.toISOString() ?? null,
      resolutionNote: detail.payrollPaymentAllocation.resolutionNote,
    })),
    canApprove,
    canGenerate,
    canCancel,
    canRelease,
    canReconcile,
    approvalBlockedReason: selfApprovalBlocked
      ? "Maker-checker: you prepared this batch. Another user must approve it, or enable ALLOW_BATCH_SELF_APPROVAL."
      : null,
    importFileDisabled:
      batch.bankExportProfile.adapterKind === "FIRST_CITIZENS_IMPORT" ||
      Boolean(fcbConfig.importFileDisabled && isFcbProfile),
    importDisabledReason: isFcbProfile
      ? (fcbConfig.importDisabledReason ??
        "First Citizens import file is disabled until the bank confirms the layout.")
      : null,
  };
}

/** Compact summary for pay-run detail header. */
export async function getPayRunPaymentStatusSummary(payRunId: string): Promise<{
  prepared: boolean;
  paymentCount: number;
  readyCount: number;
  batchCount: number;
  latestBatchStatus: string | null;
} | null> {
  const run = await prisma.payRun.findUnique({
    where: { id: payRunId },
    select: {
      id: true,
      payrollPayments: { select: { paymentStatus: true } },
      achPaymentBatches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });

  if (!run) {
    return null;
  }

  return {
    prepared: run.payrollPayments.length > 0,
    paymentCount: run.payrollPayments.length,
    readyCount: run.payrollPayments.filter(
      (row) =>
        row.paymentStatus === "READY" ||
        row.paymentStatus === "INCLUDED_IN_BATCH",
    ).length,
    batchCount: await prisma.achPaymentBatch.count({ where: { payRunId } }),
    latestBatchStatus: run.achPaymentBatches[0]?.status ?? null,
  };
}
