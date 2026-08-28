import type { Metadata } from "next";

import {
  MonthlyPayrollReportPrintContent,
} from "@/src/modules/payroll/components/print/payroll-report-print-content";
import { getMonthlyPayrollSummary } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print monthly payroll",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function MonthlyPayrollReportPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePayrollViewAccess();
  const params = await searchParams;
  const data = await getMonthlyPayrollSummary({
    periodKey: typeof params.month === "string" ? params.month : undefined,
  });
  const periodLabel =
    data.summary.periodName ??
    formatPayslipPeriodLabel(data.selectedPeriodKey) ??
    data.selectedPeriodKey;

  return (
    <ReportPrintPage
      title="Monthly payroll"
      metaLines={[`Period: ${periodLabel}`]}
    >
      <MonthlyPayrollReportPrintContent data={data} />
    </ReportPrintPage>
  );
}
