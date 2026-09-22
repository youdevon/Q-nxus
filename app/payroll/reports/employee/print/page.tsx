import { redirect } from "next/navigation";

import { buildListFilterUrl } from "@/src/lib/list-filter-url";
import { parseMonthlyPayrollEmployeeIds } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  scope?: string;
  employeeId?: string | string[];
  employeeIds?: string | string[];
  departmentId?: string;
  preset?: string;
  start?: string;
  end?: string;
}>;

/**
 * Legacy employee payment history print → consolidated Posted payroll print.
 */
export default async function EmployeePaymentHistoryPrintRedirectPage({
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

  const rawScope = params.scope?.trim();
  const scope =
    rawScope === "department"
      ? "department"
      : rawScope === "employee" ||
          rawScope === "selected" ||
          employeeIds.length > 0
        ? "selected"
        : "all";

  redirect(
    buildListFilterUrl("/payroll/reports/monthly/print", {
      scope,
      employeeIds: employeeIds.length > 0 ? employeeIds : undefined,
      departmentId: params.departmentId,
      preset: params.preset,
      start: params.start,
      end: params.end,
      generated: "1",
    }),
  );
}
