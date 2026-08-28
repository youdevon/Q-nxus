import type { Metadata } from "next";

import { PayRunApprovalLogReportView } from "@/src/modules/reports/components/pay-run-approval-log-report";
import { getPayRunApprovalLogReport } from "@/src/modules/reports/data/get-pay-run-approval-log";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Pay run approval log",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ dateFrom?: string; dateTo?: string }>;

export default async function PayRunApprovalLogReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireReportAccess(findReportDefinition("pay-run-approval-log")!);
  const params = await searchParams;
  const data = await getPayRunApprovalLogReport({
    dateFrom: typeof params.dateFrom === "string" ? params.dateFrom : undefined,
    dateTo: typeof params.dateTo === "string" ? params.dateTo : undefined,
  });

  return <PayRunApprovalLogReportView data={data} />;
}
