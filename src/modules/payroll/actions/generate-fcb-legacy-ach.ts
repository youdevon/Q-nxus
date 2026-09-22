"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";
import { loadAchExportSettings } from "@/src/modules/payroll/data/get-ach-settings";
import { createConfiguredPrefixSequenceGenerator } from "@/src/modules/payroll/lib/ach/ach-trace-generator";
import { exportFcbLegacyNachaNoHeader } from "@/src/modules/payroll/lib/ach/fcb-legacy-exporter";
import { FCB_TT_LEGACY_NACHA_NO_HEADER_V1 } from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import type { AchCandidateRow } from "@/src/modules/payroll/lib/ach/ach-validation";
import { getAchParticipantBanks } from "@/src/modules/payroll/data/get-ach-participant-banks";
import { decryptAccountNumber } from "@/src/modules/payroll/lib/bank-account-crypto";
import { resolveFirstCitizensAbaNumber } from "@/src/modules/payroll/lib/payment-instructions";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { createAchPaymentBatch } from "@/src/modules/payroll/services/ach-payment-batch";
import { invalidateAchBatchesIfPayrollChanged } from "@/src/modules/payroll/services/invalidate-ach-batches";
import { preparePayrollPaymentsForPayRun } from "@/src/modules/payroll/services/prepare-payroll-payments";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  resolveStoredFileAbsolutePath,
  safeStoredFileName,
} from "@/src/lib/stored-file";

export type AchGenerateFormState = {
  status: "idle" | "success" | "error";
  message: string;
  downloadHref?: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function moneyValue(value: { toString(): string }): number {
  return Number(value.toString());
}

/**
 * Preview → generate FCB_TT_LEGACY_NACHA_NO_HEADER_V1 file for a posted pay run.
 */
export async function generateFcbLegacyAchFromPayRun(
  _previous: AchGenerateFormState,
  formData: FormData,
): Promise<AchGenerateFormState> {
  const actor = await requireActor(
    "payroll.ach.generate",
    "payroll.payment_batches.export",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const payRunId = textValue(formData, "payRunId");
  if (!payRunId) {
    return { status: "error", message: "Pay run id is required." };
  }

  const audit = await getAuditRequestMetadata(formData);

  const organizationId = await getSessionOrganizationId();
  if (!organizationId) {
    return {
      status: "error",
      message: "No organization is associated with this session.",
    };
  }

  const run = await prisma.payRun.findFirst({
    where: { id: payRunId, organizationId },
    select: {
      id: true,
      runNumber: true,
      status: true,
      currency: true,
      organizationId: true,
      payrollPeriod: { select: { periodEnd: true, name: true, periodKey: true } },
    },
  });
  if (!run || !isPayRunPosted(run.status)) {
    return { status: "error", message: "Posted pay run not found." };
  }

  const settings = await loadAchExportSettings(run.organizationId);
  if (!settings.enabled) {
    return {
      status: "error",
      message: "ACH export is disabled. Turn it on in Payroll Settings → ACH.",
    };
  }

  const prepared = await preparePayrollPaymentsForPayRun({
    payRunId,
    actorUserId: actor.actor.userId,
    audit,
  });
  if (!prepared.ok) {
    return { status: "error", message: prepared.error };
  }

  await invalidateAchBatchesIfPayrollChanged({
    payRunId,
    organizationId: run.organizationId,
    actorUserId: actor.actor.userId,
    audit,
  });

  const importProfile = await prisma.bankExportProfile.findFirst({
    where: {
      organizationId: run.organizationId,
      isActive: true,
      OR: [{ code: "FCB_IMPORT" }, { adapterKind: "FIRST_CITIZENS_IMPORT" }],
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const created = await createAchPaymentBatch({
    payRunId,
    actorUserId: actor.actor.userId,
    preferManualRegister: false,
    bankExportProfileId: importProfile?.id,
    audit,
  });

  let batchId = created.ok ? created.data.batchId : null;
  if (!created.ok) {
    const reusable = await prisma.achPaymentBatch.findFirst({
      where: {
        payRunId,
        organizationId: run.organizationId,
        status: {
          in: ["READY_FOR_APPROVAL", "APPROVED", "GENERATED", "EXPORTED", "INVALIDATED"],
        },
        OR: [
          { exportFormat: FCB_TT_LEGACY_NACHA_NO_HEADER_V1 },
          { bankExportProfile: { adapterKind: "FIRST_CITIZENS_IMPORT" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (!reusable) {
      return { status: "error", message: created.error };
    }
    batchId = reusable.id;
  }

  // Build candidates from batch details + decrypted accounts.
  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: batchId! },
    include: {
      details: {
        orderBy: { sequence: "asc" },
        include: {
          payrollPaymentAllocation: {
            select: {
              accountNumberEncrypted: true,
              accountType: true,
              beneficiaryName: true,
              employeeBankAccount: {
                select: {
                  routingNumber: true,
                  accountType: true,
                  accountHolderName: true,
                  financialInstitution: {
                    select: { routingCode: true, displayName: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!batch) {
    return { status: "error", message: "ACH batch not found." };
  }

  const isRegen =
    Boolean(batch.fileStorageKey) ||
    batch.status === "GENERATED" ||
    batch.status === "EXPORTED" ||
    batch.status === "INVALIDATED" ||
    batch.isRegenerated;
  if (isRegen) {
    const canRegen =
      actor.actor.can("payroll.ach.regenerate") ||
      actor.actor.can("payroll.manage");
    if (!canRegen) {
      return {
        status: "error",
        message: "Regenerating an ACH file requires payroll.ach.regenerate.",
      };
    }
  }

  const paymentDate =
    batch.effectivePaymentDate?.toISOString().slice(0, 10) ??
    run.payrollPeriod.periodEnd.toISOString().slice(0, 10);

  const rows: AchCandidateRow[] = batch.details.map((detail) => {
    let accountNumber: string | null = null;
    try {
      accountNumber = decryptAccountNumber(
        detail.payrollPaymentAllocation.accountNumberEncrypted,
      );
    } catch {
      accountNumber = null;
    }
    const bank = detail.payrollPaymentAllocation.employeeBankAccount;
    const routing =
      detail.abaNumber ||
      resolveFirstCitizensAbaNumber({
        routingNumber: bank?.routingNumber,
        routingCode: bank?.financialInstitution?.routingCode,
        institutionDisplayName: bank?.financialInstitution?.displayName,
        bankName: detail.bankName,
      });
    return {
      sequence: detail.sequence,
      employeeId: detail.employeeNumber,
      employeeNumber: detail.employeeNumber,
      employeeName: detail.employeeName,
      bankName: detail.bankName,
      routingNumber: routing || null,
      accountNumber,
      accountNumberMasked: detail.accountNumberMasked,
      accountType:
        bank?.accountType ?? detail.payrollPaymentAllocation.accountType,
      paymentType: detail.paymentType,
      beneficiaryName:
        detail.payrollPaymentAllocation.beneficiaryName ??
        bank?.accountHolderName ??
        null,
      amount: moneyValue(detail.amount),
      currencyCode: detail.currencyCode,
      excluded: detail.excludedFromExport,
      exclusionReason: detail.exclusionReason,
      traceNumber: detail.traceNumber,
    };
  });

  // Resolve employeeId properly from payments
  const payments = await prisma.payrollPayment.findMany({
    where: { payRunId },
    select: {
      employeeId: true,
      payslip: { select: { employeeNumber: true } },
    },
  });
  const employeeIdByNumber = new Map(
    payments.map((p) => [p.payslip.employeeNumber, p.employeeId]),
  );
  for (const row of rows) {
    row.employeeId = employeeIdByNumber.get(row.employeeNumber) ?? row.employeeId;
  }

  try {
    const generator = createConfiguredPrefixSequenceGenerator({
      organizationId: run.organizationId,
      settings,
    });
    // Deliberate regenerate allocates fresh traces; first generate freezes them.
    const reuseExistingTraces =
      !isRegen && batch.details.some((d) => d.traceNumber);
    const routingRegistry = await getAchParticipantBanks();
    const exported = await exportFcbLegacyNachaNoHeader({
      rows,
      settings,
      paymentDate,
      currencyCode: run.currency,
      traceGenerator: generator,
      reuseExistingTraces,
      routingRegistry,
    });

    const safeName = safeStoredFileName(exported.fileName);
    const storageKey = path.posix.join(
      "ach-exports",
      batch.id,
      `${Date.now()}-${safeName}`,
    );
    const absolute = resolveStoredFileAbsolutePath(storageKey, "ach-exports");
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, exported.content, "utf8");

    await prisma.$transaction(async (tx) => {
      await tx.achPaymentBatch.update({
        where: { id: batch.id },
        data: {
          status: "GENERATED",
          exportFormat: FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
          fileName: exported.fileName,
          fileStorageKey: storageKey,
          fileContentHash: exported.contentHash,
          fileMimeType: exported.mimeType,
          controlTotalAmount: new Prisma.Decimal(
            exported.controlTotalAmount.toFixed(2),
          ),
          detailCount: exported.detailCount,
          generatedAt: new Date(),
          bankValidationStatus: "GENERATED",
          isRegenerated: isRegen,
          fcbErrorCode: null,
          fcbErrorMessage: null,
          fcbValidationErrorJson: Prisma.JsonNull,
          correctedAt: null,
          notes: isRegen
            ? `Regenerated ${exported.fileName} at ${new Date().toISOString()}.`
            : batch.notes,
          validationSummaryJson:
            exported.validation as unknown as Prisma.InputJsonValue,
        },
      });

      for (const entry of exported.entries) {
        await tx.achPaymentBatchDetail.updateMany({
          where: {
            achPaymentBatchId: batch.id,
            sequence: entry.sequence,
          },
          data: {
            transactionCode: entry.transactionCode,
            traceNumber: entry.traceNumber,
            individualId: entry.salaryReference,
            abaNumber: entry.routingNumber,
          },
        });
      }

      await tx.payrollPaymentAllocation.updateMany({
        where: {
          id: { in: batch.details.map((d) => d.payrollPaymentAllocationId) },
        },
        data: { status: "EXPORTED" },
      });
    });

    await recordAuditEvent(prisma, {
      userId: actor.actor.userId,
      organizationId: run.organizationId,
      moduleKey: "payroll",
      action: isRegen ? "REGENERATE_ACH_FILE" : "GENERATE_ACH_FILE",
      entityType: "AchPaymentBatch",
      entityId: batch.id,
      description: `${isRegen ? "Regenerated" : "Generated"} ${exported.fileName} (${exported.detailCount} credits, ${exported.controlTotalAmount.toFixed(2)} ${run.currency}).`,
      newValues: {
        exportFormat: FCB_TT_LEGACY_NACHA_NO_HEADER_V1,
        fileName: exported.fileName,
        contentHash: exported.contentHash,
        detailCount: exported.detailCount,
        controlTotalAmount: exported.controlTotalAmount,
      },
      ...audit,
    });

    revalidatePath(`/payroll/runs/${payRunId}`);
    revalidatePath(`/payroll/runs/${payRunId}/ach`);
    revalidatePath(`/payroll/runs/${payRunId}/payments`);

    return {
      status: "success",
      message: `ACH file ${exported.fileName} generated.`,
      downloadHref: `/payroll/runs/${payRunId}/payments/${batch.id}/download`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate FCB ACH file.",
    };
  }
}

export async function updateAchBankValidationStatus(
  _previous: AchGenerateFormState,
  formData: FormData,
): Promise<AchGenerateFormState> {
  const actor = await requireActor(
    "payroll.ach.view",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const batchId = textValue(formData, "batchId");
  const payRunId = textValue(formData, "payRunId");
  const status = textValue(formData, "bankValidationStatus");
  const fcbErrorCode = textValue(formData, "fcbErrorCode") || null;
  const fcbErrorMessage = textValue(formData, "fcbErrorMessage") || null;

  const allowed = new Set([
    "GENERATED",
    "UPLOADED_FOR_VALIDATION",
    "VALIDATION_FAILED",
    "BANK_VALIDATED",
    "SUBMITTED",
    "PROCESSED",
    "REJECTED",
  ]);
  if (!batchId || !allowed.has(status)) {
    return { status: "error", message: "Invalid bank validation status." };
  }

  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: batchId },
    select: { id: true, organizationId: true, payRunId: true },
  });
  if (!batch) {
    return { status: "error", message: "Batch not found." };
  }

  await prisma.achPaymentBatch.update({
    where: { id: batchId },
    data: {
      bankValidationStatus: status as never,
      fcbErrorCode,
      fcbErrorMessage,
      correctedAt:
        status === "VALIDATION_FAILED" || status === "REJECTED"
          ? null
          : undefined,
    },
  });

  const audit = await getAuditRequestMetadata(formData);
  await recordAuditEvent(prisma, {
    userId: actor.actor.userId,
    organizationId: batch.organizationId,
    moduleKey: "payroll",
    action: "UPDATE_ACH_BANK_VALIDATION",
    entityType: "AchPaymentBatch",
    entityId: batchId,
    description: `ACH bank validation status → ${status}.`,
    newValues: { bankValidationStatus: status, fcbErrorCode, fcbErrorMessage },
    ...audit,
  });

  revalidatePath(`/payroll/runs/${payRunId || batch.payRunId}/ach`);
  return { status: "success", message: "Bank validation status updated." };
}
