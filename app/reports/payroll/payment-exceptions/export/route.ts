import { getPaymentExceptionsReport } from "@/src/modules/reports/data/get-payment-exceptions-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildPaymentExceptionsExportTable } from "@/src/modules/reports/lib/report-export-builders";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("payment-exceptions")!);
  const data = await getPaymentExceptionsReport();
  const date = new Date().toISOString().slice(0, 10);

  return respondWithReportExport({
    request,
    table: buildPaymentExceptionsExportTable(data),
    fileNameBase: `payment-exceptions-${date}`,
  });
}
