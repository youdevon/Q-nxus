/**
 * Payment returns / reconciliation — does NOT reverse the pay run or unrelated payments.
 */

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";

function money(value: { toString(): string }): number {
  return Number(value.toString());
}

export type MarkAllocationReturnedResult =
  | {
      ok: true;
      allocationId: string;
      status: "RETURNED" | "REJECTED";
    }
  | { ok: false; error: string };

export type ResolveAllocationResult =
  | { ok: true; allocationId: string }
  | { ok: false; error: string };

export type RegenerateFailedPaymentResult =
  | {
      ok: true;
      originalAllocationId: string;
      replacementAllocationId: string;
    }
  | { ok: false; error: string };

/**
 * Mark a payment allocation as RETURNED or REJECTED.
 * Preserves the original row; does not reverse the pay run or sibling payments.
 */
export async function markPaymentAllocationReturned(input: {
  allocationId: string;
  actorUserId: string;
  outcome: "RETURNED" | "REJECTED";
  returnCode?: string | null;
  returnReason?: string | null;
  returnedAmount?: number | null;
  settledAt?: Date | null;
  audit?: AuditRequestMetadata;
}): Promise<MarkAllocationReturnedResult> {
  const allocation = await prisma.payrollPaymentAllocation.findUnique({
    where: { id: input.allocationId },
    include: {
      payrollPayment: {
        select: {
          id: true,
          organizationId: true,
          payRunId: true,
          employeeId: true,
        },
      },
    },
  });

  if (!allocation) {
    return { ok: false, error: "Payment allocation not found." };
  }

  if (
    allocation.status === "RETURNED" ||
    allocation.status === "REJECTED" ||
    allocation.status === "RESOLVED" ||
    allocation.status === "CANCELLED"
  ) {
    return {
      ok: false,
      error: `Allocation is already ${allocation.status}.`,
    };
  }

  const lineAmount = money(allocation.amount);
  const returnedAmount =
    input.returnedAmount == null
      ? lineAmount
      : Math.min(lineAmount, Math.max(0, input.returnedAmount));

  const now = new Date();
  await prisma.payrollPaymentAllocation.update({
    where: { id: allocation.id },
    data: {
      status: input.outcome,
      returnCode: input.returnCode?.trim() || null,
      returnReason: input.returnReason?.trim() || null,
      returnedAmount: new Prisma.Decimal(returnedAmount.toFixed(2)),
      returnedAt: now,
      settledAt: input.settledAt ?? now,
    },
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: allocation.payrollPayment.organizationId,
    moduleKey: "payroll",
    action: "PAYMENT_ALLOCATION_RETURN",
    entityType: "PayrollPaymentAllocation",
    entityId: allocation.id,
    description: `Marked payment allocation ${input.outcome} (${allocation.accountNumberMasked}, ${returnedAmount.toFixed(2)} ${allocation.currencyCode}).`,
    newValues: {
      outcome: input.outcome,
      returnCode: input.returnCode?.trim() || null,
      returnReason: input.returnReason?.trim() || null,
      returnedAmount,
      accountNumberMasked: allocation.accountNumberMasked,
      payRunId: allocation.payrollPayment.payRunId,
      payrollPaymentId: allocation.payrollPayment.id,
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return { ok: true, allocationId: allocation.id, status: input.outcome };
}

/**
 * Mark a returned/rejected/failed allocation as RESOLVED (manual payment / acknowledged).
 * Does not reverse the pay run. Original failed txn row is preserved.
 */
export async function resolvePaymentAllocation(input: {
  allocationId: string;
  actorUserId: string;
  resolutionNote: string;
  audit?: AuditRequestMetadata;
}): Promise<ResolveAllocationResult> {
  const note = input.resolutionNote.trim();
  if (!note) {
    return { ok: false, error: "A resolution note is required." };
  }

  const allocation = await prisma.payrollPaymentAllocation.findUnique({
    where: { id: input.allocationId },
    include: {
      payrollPayment: {
        select: { id: true, organizationId: true, payRunId: true },
      },
    },
  });

  if (!allocation) {
    return { ok: false, error: "Payment allocation not found." };
  }

  if (
    allocation.status !== "RETURNED" &&
    allocation.status !== "REJECTED" &&
    allocation.status !== "FAILED"
  ) {
    return {
      ok: false,
      error: `Only RETURNED, REJECTED, or FAILED allocations can be resolved (current: ${allocation.status}).`,
    };
  }

  const now = new Date();
  await prisma.payrollPaymentAllocation.update({
    where: { id: allocation.id },
    data: {
      status: "RESOLVED",
      resolutionNote: note,
      resolvedAt: now,
      resolvedByUserId: input.actorUserId,
      settledAt: allocation.settledAt ?? now,
    },
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: allocation.payrollPayment.organizationId,
    moduleKey: "payroll",
    action: "PAYMENT_ALLOCATION_RESOLVE",
    entityType: "PayrollPaymentAllocation",
    entityId: allocation.id,
    description: `Resolved payment allocation ${allocation.accountNumberMasked} as manual/acknowledged.`,
    newValues: {
      resolutionNote: note,
      previousStatus: allocation.status,
      accountNumberMasked: allocation.accountNumberMasked,
      payRunId: allocation.payrollPayment.payRunId,
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return { ok: true, allocationId: allocation.id };
}

/**
 * Create a replacement READY allocation for a failed/returned line.
 * Original row stays RETURNED/REJECTED/FAILED — never deleted.
 */
export async function regenerateFailedPaymentAllocation(input: {
  allocationId: string;
  actorUserId: string;
  note?: string | null;
  audit?: AuditRequestMetadata;
}): Promise<RegenerateFailedPaymentResult> {
  const original = await prisma.payrollPaymentAllocation.findUnique({
    where: { id: input.allocationId },
    include: {
      payrollPayment: {
        select: { id: true, organizationId: true, payRunId: true },
      },
    },
  });

  if (!original) {
    return { ok: false, error: "Payment allocation not found." };
  }

  if (
    original.status !== "RETURNED" &&
    original.status !== "REJECTED" &&
    original.status !== "FAILED"
  ) {
    return {
      ok: false,
      error: `Only RETURNED, REJECTED, or FAILED allocations can be regenerated (current: ${original.status}).`,
    };
  }

  const maxSequence = await prisma.payrollPaymentAllocation.aggregate({
    where: { payrollPaymentId: original.payrollPaymentId },
    _max: { sequence: true },
  });
  const nextSequence = (maxSequence._max.sequence ?? original.sequence) + 1;

  const replacement = await prisma.$transaction(async (tx) => {
    await tx.payrollPaymentAllocation.update({
      where: { id: original.id },
      data: {
        resolutionNote:
          input.note?.trim() ||
          original.resolutionNote ||
          "Superseded by regenerated payment allocation.",
        resolvedAt: new Date(),
        resolvedByUserId: input.actorUserId,
      },
    });

    return tx.payrollPaymentAllocation.create({
      data: {
        payrollPaymentId: original.payrollPaymentId,
        sourceAllocationId: original.sourceAllocationId,
        employeeBankAccountId: original.employeeBankAccountId,
        financialInstitutionId: original.financialInstitutionId,
        beneficiaryName: original.beneficiaryName,
        bankName: original.bankName,
        branchCode: original.branchCode,
        branchName: original.branchName,
        accountType: original.accountType,
        accountNumberMasked: original.accountNumberMasked,
        accountNumberEncrypted: original.accountNumberEncrypted,
        amount: original.amount,
        currencyCode: original.currencyCode,
        sequence: nextSequence,
        allocationKind: original.allocationKind,
        status: "READY",
      },
      select: { id: true },
    });
  });

  await recordAuditEvent(prisma, {
    userId: input.actorUserId,
    organizationId: original.payrollPayment.organizationId,
    moduleKey: "payroll",
    action: "PAYMENT_ALLOCATION_REGENERATE",
    entityType: "PayrollPaymentAllocation",
    entityId: replacement.id,
    description: `Regenerated payment allocation from ${original.accountNumberMasked} (original ${original.id} preserved).`,
    newValues: {
      originalAllocationId: original.id,
      replacementAllocationId: replacement.id,
      accountNumberMasked: original.accountNumberMasked,
      payRunId: original.payrollPayment.payRunId,
      note: input.note?.trim() || null,
    },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
    clientHostName: input.audit?.clientHostName,
  });

  return {
    ok: true,
    originalAllocationId: original.id,
    replacementAllocationId: replacement.id,
  };
}
