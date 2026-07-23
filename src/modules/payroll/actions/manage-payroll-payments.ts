"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  approveAchPaymentBatch,
  cancelAchPaymentBatch,
  createAchPaymentBatch,
  generateAchPaymentBatchFile,
  markAchPaymentBatchReconciled,
  markAchPaymentBatchReleased,
} from "@/src/modules/payroll/services/ach-payment-batch";
import {
  notifyAchBatchApproved,
  notifyAchBatchFileGenerated,
  notifyAchBatchPendingApproval,
} from "@/src/modules/payroll/services/notify-payroll-events";
import { preparePayrollPaymentsForPayRun } from "@/src/modules/payroll/services/prepare-payroll-payments";

export type PayrollPaymentActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function preparePayRunPayments(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_batches.prepare",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const payRunId = textValue(formData, "payRunId");
  if (!payRunId) {
    return { status: "error", message: "Pay run id is required." };
  }

  const audit = await getAuditRequestMetadata();
  const result = await preparePayrollPaymentsForPayRun({
    payRunId,
    actorUserId: actor.actor.userId,
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  revalidatePath(`/payroll/runs/${payRunId}`);
  revalidatePath(`/payroll/runs/${payRunId}/payments`);

  if (result.alreadyPrepared) {
    return {
      status: "success",
      message: `Payments already prepared (${result.summary.paymentCount} payment${result.summary.paymentCount === 1 ? "" : "s"}, ${result.summary.readyCount} ready).`,
    };
  }

  return {
    status: "success",
    message: `Prepared ${result.summary.paymentCount} payment${result.summary.paymentCount === 1 ? "" : "s"} (${result.summary.readyCount} ready).`,
  };
}

export async function createPayRunPaymentBatch(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_batches.prepare",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const payRunId = textValue(formData, "payRunId");
  const mode = textValue(formData, "mode"); // "ach" | "manual"
  const profileId = textValue(formData, "bankExportProfileId");

  if (!payRunId) {
    return { status: "error", message: "Pay run id is required." };
  }

  const audit = await getAuditRequestMetadata();
  const result = await createAchPaymentBatch({
    payRunId,
    actorUserId: actor.actor.userId,
    bankExportProfileId: profileId || null,
    preferManualRegister: mode === "manual",
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  revalidatePath(`/payroll/runs/${payRunId}`);
  revalidatePath(`/payroll/runs/${payRunId}/payments`);
  revalidatePath(`/payroll/runs/${payRunId}/payments/${result.data.batchId}`);

  if (result.data.status === "PENDING_APPROVAL") {
    const run = await prisma.payRun.findUnique({
      where: { id: payRunId },
      select: { organizationId: true },
    });
    if (run) {
      await notifyAchBatchPendingApproval({
        organizationId: run.organizationId,
        payRunId,
        batchId: result.data.batchId,
        batchNumber: result.data.batchNumber,
        actorUserId: actor.actor.userId,
      });
    }
  }

  return {
    status: "success",
    message: `Created batch ${result.data.batchNumber} (${result.data.detailCount} lines, ${result.data.controlTotalAmount.toFixed(2)}).`,
  };
}

export async function approvePayRunPaymentBatch(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_batches.approve",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const batchId = textValue(formData, "batchId");
  const payRunId = textValue(formData, "payRunId");

  if (!batchId) {
    return { status: "error", message: "Batch id is required." };
  }

  const audit = await getAuditRequestMetadata();
  const result = await approveAchPaymentBatch({
    batchId,
    actorUserId: actor.actor.userId,
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: batchId },
    select: {
      batchNumber: true,
      preparedByUserId: true,
      payRunId: true,
      organizationId: true,
    },
  });
  if (batch) {
    await notifyAchBatchApproved({
      organizationId: batch.organizationId,
      batchId,
      batchNumber: batch.batchNumber,
      payRunId: payRunId || batch.payRunId,
      preparedByUserId: batch.preparedByUserId,
      actorUserId: actor.actor.userId,
    });
  }

  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}`);
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
    revalidatePath(`/payroll/runs/${payRunId}/payments/${batchId}`);
  }

  return {
    status: "success",
    message: "Payment batch approved.",
  };
}

export async function generatePayRunPaymentBatchFile(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_batches.export",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const batchId = textValue(formData, "batchId");
  const payRunId = textValue(formData, "payRunId");

  if (!batchId || !payRunId) {
    return { status: "error", message: "Batch and pay run ids are required." };
  }

  const run = await prisma.payRun.findUnique({
    where: { id: payRunId },
    select: { runNumber: true },
  });
  if (!run) {
    return { status: "error", message: "Pay run not found." };
  }

  const audit = await getAuditRequestMetadata();
  const result = await generateAchPaymentBatchFile({
    batchId,
    actorUserId: actor.actor.userId,
    runNumber: run.runNumber,
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  const runOrg = await prisma.payRun.findUnique({
    where: { id: payRunId },
    select: { organizationId: true },
  });
  const batchMeta = await prisma.achPaymentBatch.findUnique({
    where: { id: batchId },
    select: { batchNumber: true },
  });
  if (runOrg && batchMeta) {
    await notifyAchBatchFileGenerated({
      organizationId: runOrg.organizationId,
      payRunId,
      batchId,
      batchNumber: batchMeta.batchNumber,
      fileName: result.data.fileName,
      actorUserId: actor.actor.userId,
    });
  }

  revalidatePath(`/payroll/runs/${payRunId}`);
  revalidatePath(`/payroll/runs/${payRunId}/payments`);
  revalidatePath(`/payroll/runs/${payRunId}/payments/${batchId}`);

  return {
    status: "success",
    message: `Generated ${result.data.fileName}. Download is available.`,
  };
}

export async function markPayRunAllocationReturned(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_returns.manage",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const allocationId = textValue(formData, "allocationId");
  const payRunId = textValue(formData, "payRunId");
  const batchId = textValue(formData, "batchId");
  const outcomeRaw = textValue(formData, "outcome");
  const outcome =
    outcomeRaw === "REJECTED" ? ("REJECTED" as const) : ("RETURNED" as const);
  const returnCode = textValue(formData, "returnCode");
  const returnReason = textValue(formData, "returnReason");

  if (!allocationId) {
    return { status: "error", message: "Allocation id is required." };
  }

  const audit = await getAuditRequestMetadata();
  const { markPaymentAllocationReturned } = await import(
    "@/src/modules/payroll/services/payment-returns"
  );
  const result = await markPaymentAllocationReturned({
    allocationId,
    actorUserId: actor.actor.userId,
    outcome,
    returnCode: returnCode || null,
    returnReason: returnReason || null,
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}`);
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
    if (batchId) {
      revalidatePath(`/payroll/runs/${payRunId}/payments/${batchId}`);
    }
  }

  return {
    status: "success",
    message: `Allocation marked ${result.status}.`,
  };
}

export async function resolvePayRunAllocation(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_returns.manage",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const allocationId = textValue(formData, "allocationId");
  const payRunId = textValue(formData, "payRunId");
  const batchId = textValue(formData, "batchId");
  const resolutionNote = textValue(formData, "resolutionNote");

  if (!allocationId) {
    return { status: "error", message: "Allocation id is required." };
  }

  const audit = await getAuditRequestMetadata();
  const { resolvePaymentAllocation } = await import(
    "@/src/modules/payroll/services/payment-returns"
  );
  const result = await resolvePaymentAllocation({
    allocationId,
    actorUserId: actor.actor.userId,
    resolutionNote,
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}`);
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
    if (batchId) {
      revalidatePath(`/payroll/runs/${payRunId}/payments/${batchId}`);
    }
  }

  return { status: "success", message: "Allocation marked resolved." };
}

export async function regeneratePayRunAllocation(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_returns.manage",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const allocationId = textValue(formData, "allocationId");
  const payRunId = textValue(formData, "payRunId");
  const batchId = textValue(formData, "batchId");
  const note = textValue(formData, "note");

  if (!allocationId) {
    return { status: "error", message: "Allocation id is required." };
  }

  const audit = await getAuditRequestMetadata();
  const { regenerateFailedPaymentAllocation } = await import(
    "@/src/modules/payroll/services/payment-returns"
  );
  const result = await regenerateFailedPaymentAllocation({
    allocationId,
    actorUserId: actor.actor.userId,
    note: note || null,
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}`);
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
    if (batchId) {
      revalidatePath(`/payroll/runs/${payRunId}/payments/${batchId}`);
    }
  }

  return {
    status: "success",
    message: "Replacement payment allocation created; original preserved.",
  };
}

export async function cancelPayRunPaymentBatch(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_batches.prepare",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const batchId = textValue(formData, "batchId");
  const payRunId = textValue(formData, "payRunId");
  const reason = textValue(formData, "reason") || null;

  if (!batchId) {
    return { status: "error", message: "Batch id is required." };
  }

  const audit = await getAuditRequestMetadata();
  const result = await cancelAchPaymentBatch({
    batchId,
    actorUserId: actor.actor.userId,
    reason,
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}`);
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
    revalidatePath(`/payroll/runs/${payRunId}/payments/${batchId}`);
  }

  return { status: "success", message: "Batch cancelled." };
}

export async function releasePayRunPaymentBatch(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_batches.export",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const batchId = textValue(formData, "batchId");
  const payRunId = textValue(formData, "payRunId");

  if (!batchId) {
    return { status: "error", message: "Batch id is required." };
  }

  const audit = await getAuditRequestMetadata();
  const result = await markAchPaymentBatchReleased({
    batchId,
    actorUserId: actor.actor.userId,
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}`);
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
    revalidatePath(`/payroll/runs/${payRunId}/payments/${batchId}`);
  }

  return { status: "success", message: "Batch marked released." };
}

export async function reconcilePayRunPaymentBatch(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor(
    "payroll.payment_batches.export",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const batchId = textValue(formData, "batchId");
  const payRunId = textValue(formData, "payRunId");

  if (!batchId) {
    return { status: "error", message: "Batch id is required." };
  }

  const audit = await getAuditRequestMetadata();
  const result = await markAchPaymentBatchReconciled({
    batchId,
    actorUserId: actor.actor.userId,
    audit,
  });

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}`);
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
    revalidatePath(`/payroll/runs/${payRunId}/payments/${batchId}`);
  }

  return { status: "success", message: "Batch reconciled." };
}
