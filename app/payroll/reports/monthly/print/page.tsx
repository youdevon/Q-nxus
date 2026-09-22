import type { Metadata } from "next";

import { MonthlyPayrollReportPrintContent } from "@/src/modules/payroll/components/print/payroll-report-print-content";
import {
  getMonthlyPayrollSummary,
  parseMonthlyPayrollEmployeeIds,
} from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { formatPayrollPeriodRangeLabel } from "@/src/modules/payroll/lib/payroll-analytics";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print posted payroll",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  month?: string;
  preset?: string;
  start?: string;
  end?: string;
  scope?: string;
  employeeId?: string | string[];
  employeeIds?: string | string[];
  departmentId?: string;
  generated?: string;
}>;

function scopeLabel(data: Awaited<ReturnType<typeof getMonthlyPayrollSummary>>) {
  if (data.scope === "selected") {
    return `${data.selectedEmployees.length} selected employee${
      data.selectedEmployees.length === 1 ? "" : "s"
    }`;
  }
  if (data.scope === "department") {
    return data.selectedDepartmentName ?? "Department";
  }
  return "All employees";
}

export default async function MonthlyPayrollReportPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePayrollViewAccess();
  const params = await searchParams;
  const employeeIds = parseMonthlyPayrollEmployeeIds([
    ...(Array.isArray(params.employeeIds)
      ? params.employeeIds
      : params.employeeIds
        ? [params.employeeIds]
        : []),
    ...(Array.isArray(params.employeeId)
      ? params.employeeId
      : params.employeeId
        ? [params.employeeId]
        : []),
  ]);

  const data = await getMonthlyPayrollSummary({
    periodKey: typeof params.month === "string" ? params.month : undefined,
    preset: typeof params.preset === "string" ? params.preset : undefined,
    startPeriodKey: typeof params.start === "string" ? params.start : undefined,
    endPeriodKey: typeof params.end === "string" ? params.end : undefined,
    scope: typeof params.scope === "string" ? params.scope : undefined,
    employeeIds,
    departmentId:
      typeof params.departmentId === "string" ? params.departmentId : undefined,
    generated: params.generated === "1",
  });
  const periodLabel =
    data.summary.periodName ??
    formatPayrollPeriodRangeLabel(
      data.period.startPeriodKey,
      data.period.endPeriodKey,
    );

  return (
    <ReportPrintPage
      title="Posted payroll"
      metaLines={[`Period: ${periodLabel}`, `Scope: ${scopeLabel(data)}`]}
      wide
    >
      <MonthlyPayrollReportPrintContent data={data} />
    </ReportPrintPage>
  );
}
