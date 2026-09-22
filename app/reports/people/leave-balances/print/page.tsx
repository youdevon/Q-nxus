import type { Metadata } from "next";

import { LeaveBalanceRosterPrintContent } from "@/src/modules/reports/components/print/phase1-report-print-content";
import { getLeaveBalanceRosterReport } from "@/src/modules/reports/data/get-leave-balance-roster";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print leave balance roster",
};

export const dynamic = "force-dynamic";

export default async function LeaveBalanceRosterPrintPage() {
  await requireReportAccess(findReportDefinition("leave-balances")!);
  const data = await getLeaveBalanceRosterReport();

  return (
    <ReportPrintPage title="Leave balance roster">
      <LeaveBalanceRosterPrintContent data={data} />
    </ReportPrintPage>
  );
}
