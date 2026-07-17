import type { Metadata } from "next";

import { MonthlyPayrollReport } from "@/src/modules/payroll/components/monthly-payroll-report";
import { getMonthlyPayrollSummary } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Monthly payroll",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  month?: string;
}>;

export default async function MonthlyPayrollReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePayrollViewAccess();
  const params = await searchParams;
  const data = await getMonthlyPayrollSummary({
    periodKey: typeof params.month === "string" ? params.month : undefined,
  });

  return <MonthlyPayrollReport data={data} />;
}
