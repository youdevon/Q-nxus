import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
} from "@/src/modules/payroll/lib/payroll-banking-flags";
import {
  generateAchPaymentBatchFile,
  markAchPaymentBatchExported,
  resolveAchExportAbsolutePath,
} from "@/src/modules/payroll/services/ach-payment-batch";
import { createAchPaymentBatch } from "@/src/modules/payroll/services/ach-payment-batch";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * ACH / payment-batch export for a posted pay run.
 * When ACH_EXPORT_ENABLED is false, returns a clear message pointing at the manual register.
 * When enabled, creates (or reuses) a batch, generates via the configured adapter, and downloads.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const capabilities = await getUserCapabilities();
  const canExport =
    capabilities?.can("payroll.manage") ||
    capabilities?.can("payroll.bank_accounts.view_sensitive");
  if (!capabilities || !canExport) {
    return new Response("Not found", { status: 404 });
  }

  const { id: payRunId } = await params;
  const url = new URL(request.url);
  const downloadBatchId = url.searchParams.get("batchId");
  const previewOnly = url.searchParams.get("preview") === "1";

  if (
    !(await isPayrollBankingFeatureEnabled(PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED))
  ) {
    return Response.json(
      {
        error: "ACH_EXPORT_DISABLED",
        message:
          "ACH file export is disabled for this organization. Use Prepare payments → Generate manual payment register, or the Bank CSV export.",
        manualRegisterPath: `/payroll/runs/${payRunId}/payments`,
        bankCsvPath: `/payroll/runs/${payRunId}/bank-export`,
      },
      { status: 403 },
    );
  }

  const run = await prisma.payRun.findFirst({
    where: {
      id: payRunId,
      organizationId: (await getCurrentUser())?.organizationId,
    },
    select: {
      id: true,
      runNumber: true,
      status: true,
      organizationId: true,
    },
  });

  if (!run || run.status !== "POSTED") {
    return new Response("Posted pay run not found", { status: 404 });
  }

  async function readAchFileOr404(storageKey: string): Promise<string | Response> {
    try {
      const absolute = resolveAchExportAbsolutePath(storageKey);
      return await readFile(absolute, "utf8");
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  // Direct download of an existing generated batch.
  if (downloadBatchId) {
    const batch = await prisma.achPaymentBatch.findFirst({
      where: {
        id: downloadBatchId,
        payRunId,
        organizationId: run.organizationId,
      },
    });
    if (!batch?.fileStorageKey || !batch.fileName) {
      return Response.json(
        {
          error: "ACH_FILE_NOT_READY",
          message: "Batch file has not been generated yet.",
        },
        { status: 404 },
      );
    }

    const contentOrError = await readAchFileOr404(batch.fileStorageKey);
    if (contentOrError instanceof Response) {
      return contentOrError;
    }
    const content = contentOrError;

    if (previewOnly) {
      return Response.json({
        batchId: batch.id,
        fileName: batch.fileName,
        contentHash: batch.fileContentHash,
        previewMasked: true,
        content: content.replace(/\d{6,}/g, (match) =>
          match.length <= 4 ? match : `••••${match.slice(-4)}`,
        ),
      });
    }

    const audit = await getAuditRequestMetadata();
    if (capabilities.can("payroll.manage")) {
      await markAchPaymentBatchExported({
        batchId: batch.id,
        actorUserId: capabilities.userId,
        audit,
      });
    }

    return new Response(content, {
      headers: {
        "content-type": batch.fileMimeType ?? "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${batch.fileName}"`,
      },
    });
  }

  if (!capabilities.can("payroll.manage")) {
    return Response.json(
      {
        error: "FORBIDDEN",
        message: "Generating ACH export requires payroll.manage.",
      },
      { status: 403 },
    );
  }

  const paymentCount = await prisma.payrollPayment.count({
    where: { payRunId },
  });
  if (paymentCount === 0) {
    return Response.json(
      {
        error: "PAYMENTS_NOT_PREPARED",
        message:
          "Prepare payments on the pay run before generating an ACH batch.",
        paymentsPath: `/payroll/runs/${payRunId}/payments`,
      },
      { status: 409 },
    );
  }

  const audit = await getAuditRequestMetadata();
  const existingGenerated = await prisma.achPaymentBatch.findFirst({
    where: {
      payRunId,
      organizationId: run.organizationId,
      status: { in: ["GENERATED", "EXPORTED"] },
      fileStorageKey: { not: null },
    },
    orderBy: { generatedAt: "desc" },
  });

  if (existingGenerated?.fileStorageKey && existingGenerated.fileName) {
    const contentOrError = await readAchFileOr404(
      existingGenerated.fileStorageKey,
    );
    if (contentOrError instanceof Response) {
      return contentOrError;
    }
    return new Response(contentOrError, {
      headers: {
        "content-type":
          existingGenerated.fileMimeType ?? "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${existingGenerated.fileName}"`,
      },
    });
  }

  const created = await createAchPaymentBatch({
    payRunId,
    actorUserId: capabilities.userId,
    preferManualRegister: false,
    audit,
  });

  if (!created.ok) {
    return Response.json(
      { error: "ACH_BATCH_CREATE_FAILED", message: created.error },
      { status: 409 },
    );
  }

  const generated = await generateAchPaymentBatchFile({
    batchId: created.data.batchId,
    actorUserId: capabilities.userId,
    runNumber: run.runNumber,
    audit,
  });

  if (!generated.ok) {
    return Response.json(
      {
        error: "ACH_BATCH_GENERATE_FAILED",
        message: generated.error,
        batchId: created.data.batchId,
        paymentsPath: `/payroll/runs/${payRunId}/payments/${created.data.batchId}`,
      },
      { status: 409 },
    );
  }

  const batch = await prisma.achPaymentBatch.findUnique({
    where: { id: created.data.batchId },
  });
  if (!batch?.fileStorageKey || !batch.fileName) {
    return Response.json(
      {
        error: "ACH_FILE_MISSING",
        message: "Batch was generated but the file is missing.",
      },
      { status: 404 },
    );
  }

  const contentOrError = await readAchFileOr404(batch.fileStorageKey);
  if (contentOrError instanceof Response) {
    return contentOrError;
  }

  await markAchPaymentBatchExported({
    batchId: batch.id,
    actorUserId: capabilities.userId,
    audit,
  });

  return new Response(contentOrError, {
    headers: {
      "content-type": batch.fileMimeType ?? "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${batch.fileName}"`,
    },
  });
}
