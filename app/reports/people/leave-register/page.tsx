import type { Metadata } from "next";

import { LeaveRegisterReportView } from "@/src/modules/reports/components/leave-register-report";
import { getLeaveRegisterReport } from "@/src/modules/reports/data/get-leave-register-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Leave register",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ dateFrom?: string; dateTo?: string }>;

export default async function LeaveRegisterReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireReportAccess(findReportDefinition("leave-register")!);
  const params = await searchParams;
  const data = await getLeaveRegisterReport({
    dateFrom: typeof params.dateFrom === "string" ? params.dateFrom : undefined,
    dateTo: typeof params.dateTo === "string" ? params.dateTo : undefined,
  });

  return <LeaveRegisterReportView data={data} />;
}
