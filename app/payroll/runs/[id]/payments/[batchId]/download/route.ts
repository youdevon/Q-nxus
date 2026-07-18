import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import {
  markAchPaymentBatchExported,
  resolveAchExportAbsolutePath,
} from "@/src/modules/payroll/services/ach-payment-batch";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; batchId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const capabilities = await getUserCapabilities();
  const canDownload =
    capabilities?.can("payroll.manage") ||
    capabilities?.can("payroll.bank_accounts.view_sensitive");
  if (!capabilities || !canDownload) {
    return new Response("Not found", { status: 404 });
  }

  const { id: payRunId, batchId } = await params;
  const batch = await prisma.achPaymentBatch.findFirst({
    where: { id: batchId, payRunId },
  });

  if (!batch?.fileStorageKey || !batch.fileName) {
    return new Response("Export file not found", { status: 404 });
  }

  const absolute = resolveAchExportAbsolutePath(batch.fileStorageKey);
  const content = await readFile(absolute, "utf8");

  if (capabilities.can("payroll.manage")) {
    const audit = await getAuditRequestMetadata();
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
