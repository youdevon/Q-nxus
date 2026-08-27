import { getEmployeePaymentHistory } from "@/src/modules/payroll/data/get-employee-payment-history";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildEmployeePaymentHistoryExportTable } from "@/src/modules/reports/lib/report-export-builders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePayrollViewAccess();

  const params = new URL(request.url).searchParams;
  const data = await getEmployeePaymentHistory({
    scope: params.get("scope") ?? undefined,
    employeeId: params.get("employeeId") ?? undefined,
    departmentId: params.get("departmentId") ?? undefined,
    query: params.get("query") ?? undefined,
    preset: params.get("preset") ?? undefined,
    startPeriodKey: params.get("start") ?? undefined,
    endPeriodKey: params.get("end") ?? undefined,
  });

  const periodSlug = `${data.period.startPeriodKey}-to-${data.period.endPeriodKey}`;

  return respondWithReportExport({
    request,
    table: buildEmployeePaymentHistoryExportTable(data),
    fileNameBase: `employee-payment-history-${periodSlug}`,
  });
}
