import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { sumMoney } from "@/src/modules/payroll/lib/money";
import { FCB_TT_LEGACY_NACHA_NO_HEADER_V1 } from "@/src/modules/payroll/lib/ach/fcb-legacy-format";

function money(value: { toString(): string }): number {
  return Number(value.toString());
}

/**
 * When frozen payroll payment nets diverge from a generated ACH batch control
 * total, mark that batch INVALIDATED so officers must regenerate.
 */
export async function invalidateAchBatchesIfPayrollChanged(input: {
  payRunId: string;
  organizationId: string;
  actorUserId?: string | null;
  audit?: AuditRequestMetadata;
}): Promise<{ invalidatedBatchIds: string[] }> {
  const [payments, batches] = await Promise.all([
    prisma.payrollPayment.findMany({
      where: {
        payRunId: input.payRunId,
        paymentStatus: { notIn: ["CANCELLED"] },
      },
      select: {
        netPay: true,
        allocations: {
          where: { status: { notIn: ["CANCELLED", "RETURNED"] } },
          select: { amount: true },
        },
      },
    }),
    prisma.achPaymentBatch.findMany({
      where: {
        payRunId: input.payRunId,
        organizationId: input.organizationId,
        status: { in: ["GENERATED", "EXPORTED", "RELEASED"] },
        OR: [
          { exportFormat: FCB_TT_LEGACY_NACHA_NO_HEADER_V1 },
          { bankExportProfile: { adapterKind: "FIRST_CITIZENS_IMPORT" } },
        ],
      },
      select: {
        id: true,
        controlTotalAmount: true,
        batchNumber: true,
      },
    }),
  ]);

  if (batches.length === 0) {
    return { invalidatedBatchIds: [] };
  }

  const currentTotal = sumMoney(
    ...payments.flatMap((payment) =>
      payment.allocations.map((row) => money(row.amount)),
    ),
  );

  const invalidatedBatchIds: string[] = [];

  for (const batch of batches) {
    const batchTotal = money(batch.controlTotalAmount);
    if (Math.abs(batchTotal - currentTotal) < 0.005) {
      continue;
    }

    await prisma.achPaymentBatch.update({
      where: { id: batch.id },
      data: {
        status: "INVALIDATED",
        notes: `Invalidated: payroll allocation total ${currentTotal.toFixed(2)} no longer matches ACH control total ${batchTotal.toFixed(2)}. Regenerate required.`,
      },
    });
    invalidatedBatchIds.push(batch.id);

    if (input.actorUserId) {
      await recordAuditEvent(prisma, {
        userId: input.actorUserId,
        organizationId: input.organizationId,
        moduleKey: "payroll",
        action: "INVALIDATE_ACH_BATCH",
        entityType: "AchPaymentBatch",
        entityId: batch.id,
        description: `Invalidated ACH batch ${batch.batchNumber} after payroll amounts changed.`,
        newValues: {
          status: "INVALIDATED",
          previousControlTotal: batchTotal,
          currentPayrollTotal: currentTotal,
        },
        ...input.audit,
      });
    }
  }

  return { invalidatedBatchIds };
}

/**
 * Soft-exclude an allocation from the open ACH batch (preview + regenerate).
 */
export async function setAchDetailExclusion(input: {
  batchId: string;
  detailId: string;
  excluded: boolean;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const detail = await prisma.achPaymentBatchDetail.findFirst({
    where: {
      id: input.detailId,
      achPaymentBatchId: input.batchId,
    },
    select: { id: true },
  });
  if (!detail) {
    return { ok: false, error: "ACH detail not found." };
  }

  await prisma.achPaymentBatchDetail.update({
    where: { id: detail.id },
    data: {
      excludedFromExport: input.excluded,
      exclusionReason: input.excluded
        ? input.reason?.trim() || "Excluded by payroll officer"
        : null,
    },
  });

  return { ok: true };
}

export async function refreshBatchControlTotal(
  batchId: string,
): Promise<void> {
  const details = await prisma.achPaymentBatchDetail.findMany({
    where: {
      achPaymentBatchId: batchId,
      excludedFromExport: false,
    },
    select: { amount: true },
  });
  const total = sumMoney(...details.map((row) => money(row.amount)));
  await prisma.achPaymentBatch.update({
    where: { id: batchId },
    data: {
      controlTotalAmount: new Prisma.Decimal(total.toFixed(2)),
      detailCount: details.length,
    },
  });
}
