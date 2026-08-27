import { getPayRunApprovalLogReport } from "@/src/modules/reports/data/get-pay-run-approval-log";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildPayRunApprovalLogExportTable } from "@/src/modules/reports/lib/report-export-builders";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("pay-run-approval-log")!);

  const params = new URL(request.url).searchParams;
  const data = await getPayRunApprovalLogReport({
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
  });

  return respondWithReportExport({
    request,
    table: buildPayRunApprovalLogExportTable(data),
    fileNameBase: `pay-run-approval-log-${data.dateFrom}-to-${data.dateTo}`,
  });
}
