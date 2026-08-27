import { getYearEndPayrollSummary } from "@/src/modules/payroll/data/get-year-end-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildYearEndPayrollExportTable } from "@/src/modules/reports/lib/report-export-builders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePayrollViewAccess();

  const params = new URL(request.url).searchParams;
  const yearParam = params.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  const { rows } = await getYearEndPayrollSummary(year);

  return respondWithReportExport({
    request,
    table: buildYearEndPayrollExportTable(year, rows),
    fileNameBase: `year-end-payroll-${year}`,
  });
}
