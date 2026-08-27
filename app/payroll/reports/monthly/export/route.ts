import { getMonthlyPayrollSummary } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildMonthlyPayrollExportTable } from "@/src/modules/reports/lib/report-export-builders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePayrollViewAccess();

  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  const data = await getMonthlyPayrollSummary({
    periodKey: typeof month === "string" ? month : undefined,
  });

  return respondWithReportExport({
    request,
    table: buildMonthlyPayrollExportTable(data),
    fileNameBase: `monthly-payroll-${data.selectedPeriodKey}`,
  });
}
