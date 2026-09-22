"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireCapability } from "@/src/modules/auth/data/get-user-capabilities";
import {
  commitPaymentInstructionImport,
  loadPaymentInstructionImportContext,
  previewPaymentInstructionsFromCsv,
} from "@/src/modules/payroll/services/import-payment-instructions";
import type { PaymentInstructionImportMode } from "@/src/modules/payroll/lib/payment-instruction-import";
import {
  deactivateEmployeeBankAccount,
  verifyEmployeeBankAccount,
} from "@/src/modules/payroll/services/verify-employee-bank-account";
import {
  cancelAchPaymentBatch,
  markAchPaymentBatchReconciled,
  markAchPaymentBatchReleased,
} from "@/src/modules/payroll/services/ach-payment-batch";

export type PaymentInstructionImportActionState = {
  status: "idle" | "preview" | "success" | "error";
  message: string;
  previewJson?: string;
  summaryJson?: string;
};

async function actorOrganizationId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

export async function previewPaymentInstructionImportAction(
  _prev: PaymentInstructionImportActionState,
  formData: FormData,
): Promise<PaymentInstructionImportActionState> {
  const capabilities = await requireCapability(
    "payroll.payment_instructions.import",
  );
  const mode = (String(formData.get("mode") ?? "CREATE_ONLY") ===
  "UPDATE_EXPLICIT"
    ? "UPDATE_EXPLICIT"
    : "CREATE_ONLY") as PaymentInstructionImportMode;
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { status: "error", message: "Choose a CSV file to import." };
  }
  const csvText = await file.text();
  const orgId = await actorOrganizationId(capabilities.userId);
  if (!orgId) {
    return { status: "error", message: "Organization context required." };
  }

  const context = await loadPaymentInstructionImportContext(orgId);
  const result = previewPaymentInstructionsFromCsv({
    csvText,
    mode,
    knownEmployeeNumbers: context.knownEmployeeNumbers,
    existingActiveKeys: context.existingActiveKeys,
  });
  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  return {
    status: "preview",
    message: result.preview.ok
      ? `Preview OK — ${result.preview.summary.validRows} valid row(s). Confirm to commit.`
      : `Preview has ${result.preview.summary.errorRows} blocking error(s).`,
    previewJson: JSON.stringify(result.preview),
  };
}

export async function commitPaymentInstructionImportAction(
  _prev: PaymentInstructionImportActionState,
  formData: FormData,
): Promise<PaymentInstructionImportActionState> {
  const capabilities = await requireCapability(
    "payroll.payment_instructions.import",
  );
  const orgId = await actorOrganizationId(capabilities.userId);
  if (!orgId) {
    return { status: "error", message: "Organization context required." };
  }

  const previewJson = String(formData.get("previewJson") ?? "");
  const dryRun = String(formData.get("dryRun") ?? "") === "1";
  const confirm = String(formData.get("confirm") ?? "") === "1";
  if (!confirm && !dryRun) {
    return {
      status: "error",
      message: "Confirmation required before saving imported instructions.",
    };
  }
  if (!previewJson) {
    return { status: "error", message: "Run preview before committing." };
  }

  let preview: Parameters<typeof commitPaymentInstructionImport>[0]["preview"];
  try {
    preview = JSON.parse(previewJson);
  } catch {
    return { status: "error", message: "Invalid preview payload." };
  }

  const audit = await getAuditRequestMetadata();
  const summary = await commitPaymentInstructionImport({
    organizationId: orgId,
    actorUserId: capabilities.userId,
    mode: preview.mode,
    preview,
    dryRun,
    audit,
  });

  revalidatePath("/payroll");
  revalidatePath("/payroll/payment-instructions/import");

  if (summary.failed > 0 && summary.created + summary.updated === 0) {
    return {
      status: "error",
      message: summary.errors.join(" ") || "Import failed.",
      summaryJson: JSON.stringify(summary),
    };
  }

  return {
    status: "success",
    message: dryRun
      ? `Dry run OK — would process ${summary.created} row(s).`
      : `Import complete — created ${summary.created}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}.`,
    summaryJson: JSON.stringify(summary),
  };
}

export async function verifyPaymentInstructionAction(formData: FormData) {
  const capabilities = await requireCapability("payroll.bank_accounts.verify");
  const accountId = String(formData.get("accountId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const audit = await getAuditRequestMetadata();
  const result = await verifyEmployeeBankAccount({
    accountId,
    actorUserId: capabilities.userId,
    audit,
  });
  if (!result.ok) {
    return { status: "error" as const, message: result.error };
  }
  revalidatePath("/payroll");
  if (employeeId) {
    revalidatePath(`/payroll/employees/${employeeId}`);
  }
  return { status: "success" as const, message: "Payment instruction verified." };
}

export async function deactivatePaymentInstructionAction(formData: FormData) {
  const capabilities = await requireCapability("payroll.bank_accounts.disable");
  const accountId = String(formData.get("accountId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const changeReason = String(formData.get("changeReason") ?? "") || null;
  const audit = await getAuditRequestMetadata();
  const result = await deactivateEmployeeBankAccount({
    accountId,
    actorUserId: capabilities.userId,
    changeReason,
    audit,
  });
  if (!result.ok) {
    return { status: "error" as const, message: result.error };
  }
  revalidatePath("/payroll");
  if (employeeId) {
    revalidatePath(`/payroll/employees/${employeeId}`);
  }
  return {
    status: "success" as const,
    message: "Payment instruction deactivated (history retained).",
  };
}

export type PaymentInstructionLifecycleState = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function verifyPaymentInstruction(
  _prev: PaymentInstructionLifecycleState,
  formData: FormData,
): Promise<PaymentInstructionLifecycleState> {
  return verifyPaymentInstructionAction(formData);
}

export async function deactivatePaymentInstruction(
  _prev: PaymentInstructionLifecycleState,
  formData: FormData,
): Promise<PaymentInstructionLifecycleState> {
  return deactivatePaymentInstructionAction(formData);
}

export async function cancelPaymentBatchAction(formData: FormData) {
  const capabilities = await requireCapability(
    "payroll.payment_batches.prepare",
  );
  const batchId = String(formData.get("batchId") ?? "");
  const reason = String(formData.get("reason") ?? "") || null;
  const payRunId = String(formData.get("payRunId") ?? "");
  const audit = await getAuditRequestMetadata();
  const result = await cancelAchPaymentBatch({
    batchId,
    actorUserId: capabilities.userId,
    reason,
    audit,
  });
  if (!result.ok) {
    return { status: "error" as const, message: result.error };
  }
  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
  }
  return { status: "success" as const, message: "Batch cancelled." };
}

export async function releasePaymentBatchAction(formData: FormData) {
  const capabilities = await requireCapability("payroll.payment_batches.export");
  const batchId = String(formData.get("batchId") ?? "");
  const payRunId = String(formData.get("payRunId") ?? "");
  const audit = await getAuditRequestMetadata();
  const result = await markAchPaymentBatchReleased({
    batchId,
    actorUserId: capabilities.userId,
    audit,
  });
  if (!result.ok) {
    return { status: "error" as const, message: result.error };
  }
  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
  }
  return { status: "success" as const, message: "Batch marked released." };
}

export async function reconcilePaymentBatchAction(formData: FormData) {
  const capabilities = await requireCapability("payroll.payment_batches.export");
  const batchId = String(formData.get("batchId") ?? "");
  const payRunId = String(formData.get("payRunId") ?? "");
  const audit = await getAuditRequestMetadata();
  const result = await markAchPaymentBatchReconciled({
    batchId,
    actorUserId: capabilities.userId,
    audit,
  });
  if (!result.ok) {
    return { status: "error" as const, message: result.error };
  }
  if (payRunId) {
    revalidatePath(`/payroll/runs/${payRunId}/payments`);
  }
  return { status: "success" as const, message: "Batch reconciled." };
}
