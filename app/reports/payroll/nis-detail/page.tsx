import type { Metadata } from "next";

import { EmployeeNisDetailReportView } from "@/src/modules/reports/components/employee-nis-detail-report";
import { getEmployeeNisDetailReport } from "@/src/modules/reports/data/get-employee-nis-detail-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Employee NIS detail",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function EmployeeNisDetailReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireReportAccess(findReportDefinition("employee-nis-detail")!);
  const params = await searchParams;
  const data = await getEmployeeNisDetailReport({
    periodKey: typeof params.month === "string" ? params.month : undefined,
  });

  return <EmployeeNisDetailReportView data={data} />;
}
