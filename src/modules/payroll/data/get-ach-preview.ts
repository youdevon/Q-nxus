import { prisma } from "@/lib/prisma";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";
import { decryptAccountNumber } from "@/src/modules/payroll/lib/bank-account-crypto";
import { loadAchExportSettings } from "@/src/modules/payroll/data/get-ach-settings";
import { getAchParticipantBanks } from "@/src/modules/payroll/data/get-ach-participant-banks";
import {
  type AchPreviewPageData,
} from "@/src/modules/payroll/data/ach-preview-types";
import { createConfiguredPrefixSequenceGenerator } from "@/src/modules/payroll/lib/ach/ach-trace-generator";
import {
  assembleAchValidationSummary,
  type AchCandidateRow,
} from "@/src/modules/payroll/lib/ach/ach-validation";
import { FCB_TT_LEGACY_NACHA_NO_HEADER_V1 } from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { resolveFirstCitizensAbaNumber } from "@/src/modules/payroll/lib/payment-instructions";
import { invalidateAchBatchesIfPayrollChanged } from "@/src/modules/payroll/services/invalidate-ach-batches";

export type { AchPreviewPageData } from "@/src/modules/payroll/data/ach-preview-types";
export { formatAchPreviewTotal } from "@/src/modules/payroll/data/ach-preview-types";

function moneyValue(value: { toString(): string } | number): number {
  if (typeof value === "number") {
    return value;
  }
  return Number(value.toString());
}

export async function getAchPreviewPageData(
  payRunId: string,
): Promise<AchPreviewPageData | null> {
  const organizationId = await getSessionOrganizationId();
  if (!organizationId) {
    return null;
  }

  const run = await prisma.payRun.findFirst({
    where: { id: payRunId, organizationId },
    select: {
      id: true,
      runNumber: true,
      status: true,
      currency: true,
      organizationId: true,
      payrollPeriod: {
        select: { name: true, periodEnd: true },
      },
      payrollPayments: {
        where: {
          paymentStatus: { notIn: ["CANCELLED"] },
        },
        include: {
          payslip: {
            select: {
              employeeNumber: true,
              employeeName: true,
            },
          },
          allocations: {
            where: {
              status: { notIn: ["CANCELLED", "RETURNED"] },
            },
            include: {
              employeeBankAccount: {
                select: {
                  accountType: true,
                  routingNumber: true,
                  accountHolderName: true,
                  financialInstitution: {
                    select: {
                      routingCode: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!run || !isPayRunPosted(run.status)) {
    return null;
  }

  await invalidateAchBatchesIfPayrollChanged({
    payRunId: run.id,
    organizationId: run.organizationId,
  });

  const latestAfter = await prisma.achPaymentBatch.findFirst({
    where: {
      payRunId: run.id,
      status: { notIn: ["CANCELLED"] },
      OR: [
        { exportFormat: FCB_TT_LEGACY_NACHA_NO_HEADER_V1 },
        { bankExportProfile: { adapterKind: "FIRST_CITIZENS_IMPORT" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      batchNumber: true,
      status: true,
      fileName: true,
      bankValidationStatus: true,
      fcbErrorMessage: true,
      exportFormat: true,
      fileStorageKey: true,
      details: {
        select: {
          payrollPaymentAllocationId: true,
          excludedFromExport: true,
          exclusionReason: true,
          traceNumber: true,
          transactionCode: true,
        },
      },
    },
  });

  const settings = await loadAchExportSettings(run.organizationId);
  const paymentDate = run.payrollPeriod.periodEnd.toISOString().slice(0, 10);

  const exclusionByAllocationId = new Map(
    (latestAfter?.details ?? []).map((detail) => [
      detail.payrollPaymentAllocationId,
      detail,
    ]),
  );
  const frozenTraceByAllocationId = new Map(
    (latestAfter?.details ?? [])
      .filter((detail) => detail.traceNumber)
      .map((detail) => [
        detail.payrollPaymentAllocationId,
        detail.traceNumber!,
      ]),
  );

  const candidates: AchCandidateRow[] = [];
  let sequence = 0;
  for (const payment of run.payrollPayments) {
    for (const allocation of payment.allocations) {
      sequence += 1;
      let accountNumber: string | null = null;
      try {
        accountNumber = decryptAccountNumber(allocation.accountNumberEncrypted);
      } catch {
        accountNumber = null;
      }
      const bank = allocation.employeeBankAccount;
      const routing = resolveFirstCitizensAbaNumber({
        routingNumber: bank?.routingNumber,
        routingCode: bank?.financialInstitution?.routingCode,
        institutionDisplayName: bank?.financialInstitution?.displayName,
        bankName: allocation.bankName,
      });
      const exclusion = exclusionByAllocationId.get(allocation.id);
      candidates.push({
        sequence,
        employeeId: payment.employeeId,
        employeeNumber: payment.payslip.employeeNumber,
        employeeName: payment.payslip.employeeName,
        bankName: allocation.bankName,
        routingNumber: routing || null,
        accountNumber,
        accountNumberMasked: allocation.accountNumberMasked,
        accountType: bank?.accountType ?? allocation.accountType,
        paymentType: null,
        beneficiaryName:
          allocation.beneficiaryName ?? bank?.accountHolderName ?? null,
        amount: moneyValue(allocation.amount),
        currencyCode: allocation.currencyCode || run.currency,
        excluded: exclusion?.excludedFromExport ?? false,
        exclusionReason: exclusion?.exclusionReason ?? null,
        traceNumber: frozenTraceByAllocationId.get(allocation.id) ?? null,
      });
    }
  }

  try {
    const needPeek = candidates.filter(
      (row) => !row.excluded && !row.traceNumber,
    );
    if (needPeek.length > 0) {
      const generator = createConfiguredPrefixSequenceGenerator({
        organizationId: run.organizationId,
        settings,
      });
      const peeked = await generator.peekNext(needPeek.length);
      let idx = 0;
      for (const row of candidates) {
        if (row.excluded || row.traceNumber) {
          continue;
        }
        row.traceNumber = peeked[idx] ?? null;
        idx += 1;
      }
    }
  } catch {
    // ODFI / strategy misconfiguration surfaces as validation errors on generate.
  }

  const routingRegistry = await getAchParticipantBanks();
  const validation = assembleAchValidationSummary({
    rows: candidates,
    settings,
    paymentDate,
    currencyCode: run.currency,
    routingRegistry,
  });

  const latest = latestAfter;

  return {
    payRunId: run.id,
    runNumber: run.runNumber,
    status: run.status,
    periodName: run.payrollPeriod.name,
    paymentDate,
    currencyCode: run.currency,
    settingsEnabled: settings.enabled,
    forceLegacyTransactionCode:
      settings.transactionCodePolicy === "FORCE_LEGACY_CODE",
    latestBatch: latest
      ? {
          id: latest.id,
          batchNumber: latest.batchNumber,
          status: latest.status,
          fileName: latest.fileName,
          bankValidationStatus: latest.bankValidationStatus,
          fcbErrorMessage: latest.fcbErrorMessage,
          exportFormat: latest.exportFormat,
          downloadHref:
            latest.fileStorageKey && latest.status !== "INVALIDATED"
              ? `/payroll/runs/${run.id}/payments/${latest.id}/download`
              : null,
        }
      : null,
    validation,
  };
}
