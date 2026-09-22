import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { formatDisplayDate } from "@/src/lib/format";
import { runKindLabel } from "@/src/modules/payroll/lib/payroll-analytics";
import type { PayRunApprovalLogReport } from "@/src/modules/reports/data/get-pay-run-approval-log";
import {
  ReportEmptyState,
  ReportExportLinks,
  ReportGenerateButton,
  ReportLayout,
  ReportPrintLink,
} from "@/src/modules/reports/components/report-layout";
import { reportPrintHref } from "@/src/modules/reports/lib/report-print";
import {
  ReportTable,
  ReportTableCell,
  ReportTableRow,
} from "@/src/modules/reports/components/report-table";

export function PayRunApprovalLogReportView({
  data,
}: {
  data: PayRunApprovalLogReport;
}) {
  const exportHref = `/reports/payroll/pay-run-approval-log/export?dateFrom=${data.dateFrom}&dateTo=${data.dateTo}`;

  return (
    <ReportLayout
      title="Pay run approval log"
      description="Pay runs approved or posted within the selected period — maker-checker audit trail."
      actions={
        <PageActionsEnd>
          <ReportPrintLink
            href={reportPrintHref("/reports/payroll/pay-run-approval-log", {
              dateFrom: data.dateFrom,
              dateTo: data.dateTo,
            })}
          />
          <ReportExportLinks href={exportHref} />
        </PageActionsEnd>
      }
      filters={
        <form
          method="get"
          action="/reports/payroll/pay-run-approval-log"
          className="flex flex-wrap items-end gap-3"
        >
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">From</span>
            <Input
              type="date"
              name="dateFrom"
              defaultValue={data.dateFrom}
              className="w-[11rem]"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">To</span>
            <Input
              type="date"
              name="dateTo"
              defaultValue={data.dateTo}
              className="w-[11rem]"
              required
            />
          </label>
          <ReportGenerateButton />
        </form>
      }
    >
      {data.rows.length === 0 ? (
        <ReportEmptyState
          message="No pay runs approved or posted in this period."
          hint="Adjust the date range above and click Generate report to refresh."
        />
      ) : (
        <ReportTable
          headers={[
            "Run",
            "Period",
            "Status",
            "Employees",
            "Gross",
            "Net",
            "Approved",
            "Posted",
          ]}
        >
          {data.rows.map((row) => (
            <ReportTableRow key={row.id}>
              <ReportTableCell>
                <Link
                  href={`/payroll/runs/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.runNumber}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {runKindLabel(
                    row.runKind as "REGULAR" | "CORRECTION" | "OFF_CYCLE",
                  )}
                </div>
              </ReportTableCell>
              <ReportTableCell className="text-xs">
                {row.periodName}
                <div className="text-muted-foreground">{row.periodKey}</div>
              </ReportTableCell>
              <ReportTableCell>
                <Badge variant="outline">{row.status}</Badge>
              </ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {row.employeeCount}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums text-xs">
                {row.totalGrossLabel}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums text-xs">
                {row.totalNetLabel}
              </ReportTableCell>
              <ReportTableCell className="text-xs">
                {formatDisplayDate(row.approvedAt, { fallback: "—" })}
                {row.approvedByName ? (
                  <div className="text-muted-foreground">{row.approvedByName}</div>
                ) : null}
              </ReportTableCell>
              <ReportTableCell className="text-xs">
                {formatDisplayDate(row.postedAt, { fallback: "—" })}
                {row.postedByName ? (
                  <div className="text-muted-foreground">{row.postedByName}</div>
                ) : null}
              </ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
