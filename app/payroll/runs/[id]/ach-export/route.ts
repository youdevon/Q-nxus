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
  markAchPaymentBatchExported,
  resolveAchExportAbsolutePath,
} from "@/src/modules/payroll/services/ach-payment-batch";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function paymentsRedirect(
  requestUrl: string,
  payRunId: string,
  error: string,
): Response {
  const url = new URL(`/payroll/runs/${payRunId}/payments`, requestUrl);
  url.searchParams.set("achError", error);
  return Response.redirect(url, 303);
}

/**
 * Legacy one-click ACH export URL.
 * Redirects to the preview-first ACH page (`/payroll/runs/[id]/ach`).
 * Direct downloads remain available via `?batchId=` for previously generated files.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const capabilities = await getUserCapabilities();
  const canExport =
    capabilities?.can("payroll.ach.view") ||
    capabilities?.can("payroll.ach.generate") ||
    capabilities?.can("payroll.ach.download") ||
    capabilities?.can("payroll.manage") ||
    capabilities?.can("payroll.bank_accounts.view_sensitive");
  if (!capabilities || !canExport) {
    return new Response("Not found", { status: 404 });
  }

  const { id: payRunId } = await params;
  const url = new URL(request.url);
  const downloadBatchId = url.searchParams.get("batchId");

  // Preserve direct download of an existing generated batch.
  if (!downloadBatchId) {
    return Response.redirect(
      new URL(`/payroll/runs/${payRunId}/ach`, request.url),
      303,
    );
  }

  const canDownload =
    capabilities.can("payroll.ach.download") ||
    capabilities.can("payroll.manage") ||
    capabilities.can("payroll.bank_accounts.view_sensitive");
  if (!canDownload) {
    return new Response("Not found", { status: 404 });
  }

  const previewOnly = url.searchParams.get("preview") === "1";
  const wantsBrowserDownload = !previewOnly;

  if (
    !(await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED,
    ))
  ) {
    if (wantsBrowserDownload) {
      return paymentsRedirect(
        request.url,
        payRunId,
        "ACH export is disabled for this organization.",
      );
    }
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

  async function readAchFileOr404(
    storageKey: string,
  ): Promise<string | Response> {
    try {
      const absolute = resolveAchExportAbsolutePath(storageKey);
      return await readFile(absolute, "utf8");
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  function fileResponse(input: {
    content: string;
    fileName: string;
    mimeType: string | null;
  }): Response {
    return new Response(input.content, {
      headers: {
        "content-type": input.mimeType ?? "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="${input.fileName}"`,
      },
    });
  }

  const batch = await prisma.achPaymentBatch.findFirst({
    where: {
      id: downloadBatchId,
      payRunId,
      organizationId: run.organizationId,
    },
  });
  if (!batch?.fileStorageKey || !batch.fileName) {
    if (wantsBrowserDownload) {
      return paymentsRedirect(
        request.url,
        payRunId,
        "Batch file has not been generated yet.",
      );
    }
    return Response.json(
      {
        error: "ACH_FILE_NOT_READY",
        message: "Batch file has not been generated yet.",
      },
      { status: 404 },
    );
  }

  if (batch.status === "INVALIDATED") {
    return Response.redirect(
      new URL(`/payroll/runs/${payRunId}/ach`, request.url),
      303,
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
  if (
    capabilities.can("payroll.manage") ||
    capabilities.can("payroll.ach.download")
  ) {
    await markAchPaymentBatchExported({
      batchId: batch.id,
      actorUserId: capabilities.userId,
      audit,
    });
  }

  return fileResponse({
    content,
    fileName: batch.fileName,
    mimeType: batch.fileMimeType,
  });
}
