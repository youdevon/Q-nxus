import type { Metadata } from "next";

import { LeaveBalanceRosterReportView } from "@/src/modules/reports/components/leave-balance-roster-report";
import { getLeaveBalanceRosterReport } from "@/src/modules/reports/data/get-leave-balance-roster";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Leave balance roster",
};

export const dynamic = "force-dynamic";

export default async function LeaveBalanceRosterReportPage() {
  await requireReportAccess(findReportDefinition("leave-balances")!);
  const data = await getLeaveBalanceRosterReport();

  return <LeaveBalanceRosterReportView data={data} />;
}
