import { getPayslipDeliveryReport } from "@/src/modules/reports/data/get-payslip-delivery-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildPayslipDeliveryExportTable } from "@/src/modules/reports/lib/report-export-builders";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("payslip-delivery")!);
  const data = await getPayslipDeliveryReport();
  const date = new Date().toISOString().slice(0, 10);

  return respondWithReportExport({
    request,
    table: buildPayslipDeliveryExportTable(data),
    fileNameBase: `payslip-delivery-${date}`,
  });
}
