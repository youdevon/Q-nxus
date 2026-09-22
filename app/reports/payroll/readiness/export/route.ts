import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import {
  findReportDefinition,
} from "@/src/modules/reports/lib/report-definitions";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildPayrollReadinessExportTable } from "@/src/modules/reports/lib/report-export-builders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("payroll-readiness")!);
  const data = await getPayrollReadiness();

  const date = new Date().toISOString().slice(0, 10);

  return respondWithReportExport({
    request,
    table: buildPayrollReadinessExportTable(data),
    fileNameBase: `payroll-readiness-${date}`,
  });
}
