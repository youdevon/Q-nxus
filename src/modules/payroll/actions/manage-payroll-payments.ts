"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  approveAchPaymentBatch,
  createAchPaymentBatch,
  generateAchPaymentBatchFile,
} from "@/src/modules/payroll/services/ach-payment-batch";
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
  const actor = await requireActor("payroll.manage");
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
  const actor = await requireActor("payroll.manage");
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

  return {
    status: "success",
    message: `Created batch ${result.data.batchNumber} (${result.data.detailCount} lines, ${result.data.controlTotalAmount.toFixed(2)}).`,
  };
}

export async function approvePayRunPaymentBatch(
  _prev: PayrollPaymentActionState,
  formData: FormData,
): Promise<PayrollPaymentActionState> {
  const actor = await requireActor("payroll.manage");
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
  const actor = await requireActor("payroll.manage");
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
