import Link from "next/link";

import { PageActionsEnd } from "@/src/components/layout/page-actions";
import type { LeaveBalanceRosterReport } from "@/src/modules/reports/data/get-leave-balance-roster";
import {
  ReportEmptyState,
  ReportExportLinks,
  ReportLayout,
  ReportPrintLink,
  ReportSummaryGrid,
} from "@/src/modules/reports/components/report-layout";
import { reportPrintHref } from "@/src/modules/reports/lib/report-print";
import {
  ReportTable,
  ReportTableCell,
  ReportTableRow,
} from "@/src/modules/reports/components/report-table";

export function LeaveBalanceRosterReportView({
  data,
}: {
  data: LeaveBalanceRosterReport;
}) {
  return (
    <ReportLayout
      title="Leave balance roster"
      description="Org-wide leave balances by type for active employees on current contracts."
      actions={
        <PageActionsEnd>
          <ReportPrintLink href={reportPrintHref("/reports/people/leave-balances")} />
          <ReportExportLinks href="/reports/people/leave-balances/export" />
        </PageActionsEnd>
      }
    >
      <ReportSummaryGrid
        items={[
          { label: "Employees", value: data.employeeCount },
          { label: "Balance rows", value: data.rows.length },
        ]}
      />

      {data.rows.length === 0 ? (
        <ReportEmptyState message="No leave balances found for active employees." />
      ) : (
        <ReportTable
          headers={[
            "Employee",
            "Department",
            "Leave type",
            "Cycle",
            "Entitlement",
            "Taken",
            "Reserved",
            "Available",
          ]}
        >
          {data.rows.map((row) => (
            <ReportTableRow
              key={`${row.employeeId}-${row.leaveTypeCode}-${row.cycleStart}`}
            >
              <ReportTableCell>
                <Link
                  href={`/people/leave/balances?employeeId=${row.employeeId}`}
                  className="font-medium hover:underline"
                >
                  {row.displayName}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {row.employeeNumber}
                </div>
              </ReportTableCell>
              <ReportTableCell>{row.departmentName ?? "—"}</ReportTableCell>
              <ReportTableCell>
                {row.leaveTypeCode}
                <div className="text-xs text-muted-foreground">
                  {row.leaveTypeName}
                </div>
              </ReportTableCell>
              <ReportTableCell className="text-xs">
                {row.cycleStart} → {row.cycleEnd}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {row.entitlement}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {row.taken}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {row.reserved}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums font-medium">
                {row.availableBalance}
              </ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
