import { getLeaveBalanceRosterReport } from "@/src/modules/reports/data/get-leave-balance-roster";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildLeaveBalanceRosterExportTable } from "@/src/modules/reports/lib/report-export-builders";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("leave-balances")!);
  const data = await getLeaveBalanceRosterReport();
  const date = new Date().toISOString().slice(0, 10);

  return respondWithReportExport({
    request,
    table: buildLeaveBalanceRosterExportTable(data),
    fileNameBase: `leave-balance-roster-${date}`,
  });
}
