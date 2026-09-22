import { redirect } from "next/navigation";

import { buildListFilterUrl } from "@/src/lib/list-filter-url";
import { parseMonthlyPayrollEmployeeIds } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const dynamic = "force-dynamic";

/**
 * Legacy employee payment history export → consolidated Posted payroll export.
 */
export async function GET(request: Request) {
  await requirePayrollViewAccess();

  const params = new URL(request.url).searchParams;
  const employeeIds = parseMonthlyPayrollEmployeeIds([
    ...params.getAll("employeeIds"),
    ...params.getAll("employeeId"),
  ]);
  const rawScope = params.get("scope")?.trim();
  const scope =
    rawScope === "department"
      ? "department"
      : rawScope === "employee" ||
          rawScope === "selected" ||
          employeeIds.length > 0
        ? "selected"
        : "all";

  const target = buildListFilterUrl("/payroll/reports/monthly/export", {
    scope,
    employeeIds: employeeIds.length > 0 ? employeeIds : undefined,
    departmentId: params.get("departmentId") ?? undefined,
    preset: params.get("preset") ?? undefined,
    start: params.get("start") ?? undefined,
    end: params.get("end") ?? undefined,
    format: params.get("format") ?? undefined,
    generated: "1",
  });

  redirect(target);
}
