import { getLeaveRegisterReport } from "@/src/modules/reports/data/get-leave-register-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildLeaveRegisterExportTable } from "@/src/modules/reports/lib/report-export-builders";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("leave-register")!);

  const params = new URL(request.url).searchParams;
  const data = await getLeaveRegisterReport({
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
  });

  return respondWithReportExport({
    request,
    table: buildLeaveRegisterExportTable(data),
    fileNameBase: `leave-register-${data.dateFrom}-to-${data.dateTo}`,
  });
}
