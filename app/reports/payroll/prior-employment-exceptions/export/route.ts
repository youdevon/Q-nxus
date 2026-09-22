import { getPriorEmploymentExceptionsReport } from "@/src/modules/reports/data/get-prior-employment-exceptions-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildPriorEmploymentExceptionsExportTable } from "@/src/modules/reports/lib/report-export-builders";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("prior-employment-exceptions")!);
  const data = await getPriorEmploymentExceptionsReport();

  return respondWithReportExport({
    request,
    table: buildPriorEmploymentExceptionsExportTable(data),
    fileNameBase: `prior-employment-exceptions-${data.taxYear}`,
  });
}
