import type { Metadata } from "next";

import { YearEndPayrollReport } from "@/src/modules/payroll/components/year-end-payroll-report";
import { getYearEndPayrollSummary } from "@/src/modules/payroll/data/get-year-end-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Year-end payroll summaries",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function YearEndPayrollReportPage({
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

  return <YearEndPayrollReport year={data.year} rows={data.rows} />;
}
