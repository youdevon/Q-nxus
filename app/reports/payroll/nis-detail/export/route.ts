import { getEmployeeNisDetailReport } from "@/src/modules/reports/data/get-employee-nis-detail-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildEmployeeNisDetailExportTable } from "@/src/modules/reports/lib/report-export-builders";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("employee-nis-detail")!);

  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  const data = await getEmployeeNisDetailReport({
    periodKey: typeof month === "string" ? month : undefined,
  });

  return respondWithReportExport({
    request,
    table: buildEmployeeNisDetailExportTable(data),
    fileNameBase: `employee-nis-detail-${data.selectedPeriodKey}`,
  });
}
