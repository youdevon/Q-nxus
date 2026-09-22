import type { Metadata } from "next";

import {
  YearEndPayrollReportPrintContent,
} from "@/src/modules/payroll/components/print/payroll-report-print-content";
import { getYearEndPayrollSummary } from "@/src/modules/payroll/data/get-year-end-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print year-end payroll",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function YearEndPayrollReportPrintPage({
  searchParams,
}: PageProps) {
  await requirePayrollViewAccess();
  const { year } = await searchParams;
  const parsedYear = Number(year);
  const selectedYear =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : new Date().getFullYear();
  const data = await getYearEndPayrollSummary(selectedYear);

  return (
    <ReportPrintPage
      title="Year-end payroll summaries"
      metaLines={[`Tax year: ${data.year}`]}
    >
      <YearEndPayrollReportPrintContent year={data.year} rows={data.rows} />
    </ReportPrintPage>
  );
}
