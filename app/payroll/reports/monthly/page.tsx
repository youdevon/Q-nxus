import type { Metadata } from "next";

import { MonthlyPayrollReport } from "@/src/modules/payroll/components/monthly-payroll-report";
import {
  getMonthlyPayrollSummary,
  parseMonthlyPayrollEmployeeIds,
} from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Posted payroll",
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

export default async function MonthlyPayrollReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePayrollViewAccess();
  const params = await searchParams;
  const generated = params.generated === "1";
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
    generated,
  });

  return <MonthlyPayrollReport data={data} />;
}
