import {
  getMonthlyPayrollSummary,
  parseMonthlyPayrollEmployeeIds,
} from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildMonthlyPayrollExportTable } from "@/src/modules/reports/lib/report-export-builders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePayrollViewAccess();

  const params = new URL(request.url).searchParams;
  const employeeIds = parseMonthlyPayrollEmployeeIds([
    ...params.getAll("employeeIds"),
    ...params.getAll("employeeId"),
  ]);

  const data = await getMonthlyPayrollSummary({
    periodKey: params.get("month") ?? undefined,
    preset: params.get("preset") ?? undefined,
    startPeriodKey: params.get("start") ?? undefined,
    endPeriodKey: params.get("end") ?? undefined,
    scope: params.get("scope") ?? undefined,
    employeeIds,
    departmentId: params.get("departmentId") ?? undefined,
    generated: params.get("generated") === "1",
  });

  const rangeSlug =
    data.period.startPeriodKey === data.period.endPeriodKey
      ? data.period.startPeriodKey
      : `${data.period.startPeriodKey}_to_${data.period.endPeriodKey}`;

  return respondWithReportExport({
    request,
    table: buildMonthlyPayrollExportTable(data),
    fileNameBase: `posted-payroll-${rangeSlug}`,
  });
}
