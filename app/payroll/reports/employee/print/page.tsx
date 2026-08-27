import type { Metadata } from "next";

import {
  EmployeePaymentHistoryReportPrintContent,
  employeePaymentHistoryMetaLines,
} from "@/src/modules/payroll/components/print/payroll-report-print-content";
import { getEmployeePaymentHistory } from "@/src/modules/payroll/data/get-employee-payment-history";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print employee payment history",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  scope?: string;
  employeeId?: string;
  departmentId?: string;
  query?: string;
  preset?: string;
  start?: string;
  end?: string;
}>;

export default async function EmployeePaymentHistoryPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePayrollViewAccess();
  const params = await searchParams;
  const data = await getEmployeePaymentHistory({
    scope: typeof params.scope === "string" ? params.scope : undefined,
    employeeId:
      typeof params.employeeId === "string" ? params.employeeId : undefined,
    departmentId:
      typeof params.departmentId === "string"
        ? params.departmentId
        : undefined,
    query: typeof params.query === "string" ? params.query : undefined,
    preset: typeof params.preset === "string" ? params.preset : undefined,
    startPeriodKey: typeof params.start === "string" ? params.start : undefined,
    endPeriodKey: typeof params.end === "string" ? params.end : undefined,
  });

  return (
    <ReportPrintPage
      title="Employee payment history"
      metaLines={employeePaymentHistoryMetaLines(data)}
    >
      <EmployeePaymentHistoryReportPrintContent data={data} />
    </ReportPrintPage>
  );
}
