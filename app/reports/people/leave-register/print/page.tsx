import type { Metadata } from "next";

import {
  LeaveRegisterPrintContent,
  leaveRegisterMetaLines,
} from "@/src/modules/reports/components/print/phase1-report-print-content";
import { getLeaveRegisterReport } from "@/src/modules/reports/data/get-leave-register-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print leave register",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ dateFrom?: string; dateTo?: string }>;

export default async function LeaveRegisterPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireReportAccess(findReportDefinition("leave-register")!);
  const params = await searchParams;
  const data = await getLeaveRegisterReport({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  return (
    <ReportPrintPage
      title="Leave register"
      metaLines={leaveRegisterMetaLines(data)}
    >
      <LeaveRegisterPrintContent data={data} />
    </ReportPrintPage>
  );
}
