import type { Metadata } from "next";

import { EmployeePaymentHistoryReport } from "@/src/modules/payroll/components/employee-payment-history-report";
import { getEmployeePaymentHistory } from "@/src/modules/payroll/data/get-employee-payment-history";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Employee payment history",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  employeeId?: string;
  query?: string;
  preset?: string;
  start?: string;
  end?: string;
}>;

export default async function EmployeePaymentHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePayrollViewAccess();
  const params = await searchParams;
  const data = await getEmployeePaymentHistory({
    employeeId:
      typeof params.employeeId === "string" ? params.employeeId : undefined,
    query: typeof params.query === "string" ? params.query : undefined,
    preset: typeof params.preset === "string" ? params.preset : undefined,
    startPeriodKey: typeof params.start === "string" ? params.start : undefined,
    endPeriodKey: typeof params.end === "string" ? params.end : undefined,
  });

  return <EmployeePaymentHistoryReport data={data} />;
}
