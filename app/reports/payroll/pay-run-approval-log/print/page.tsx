import type { Metadata } from "next";

import {
  PayRunApprovalLogPrintContent,
  payRunApprovalLogMetaLines,
} from "@/src/modules/reports/components/print/phase1-report-print-content";
import { getPayRunApprovalLogReport } from "@/src/modules/reports/data/get-pay-run-approval-log";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print pay run approval log",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ dateFrom?: string; dateTo?: string }>;

export default async function PayRunApprovalLogPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireReportAccess(findReportDefinition("pay-run-approval-log")!);
  const params = await searchParams;
  const data = await getPayRunApprovalLogReport({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  return (
    <ReportPrintPage
      title="Pay run approval log"
      metaLines={payRunApprovalLogMetaLines(data)}
    >
      <PayRunApprovalLogPrintContent data={data} />
    </ReportPrintPage>
  );
}
