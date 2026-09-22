import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { formatDisplayDate } from "@/src/lib/format";
import type { LeaveRegisterReport } from "@/src/modules/reports/data/get-leave-register-report";
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

export function LeaveRegisterReportView({ data }: { data: LeaveRegisterReport }) {
  const exportHref = `/reports/people/leave-register/export?dateFrom=${data.dateFrom}&dateTo=${data.dateTo}`;

  return (
    <ReportLayout
      title="Leave register"
      description="Approved leave overlapping the selected period — paid vs unpaid by leave type."
      actions={
        <PageActionsEnd>
          <ReportPrintLink
            href={reportPrintHref("/reports/people/leave-register", {
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
          action="/reports/people/leave-register"
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
          message="No approved leave in this period."
          hint="Adjust the date range above and click Generate report to refresh."
        />
      ) : (
        <ReportTable
          headers={[
            "Employee",
            "Leave type",
            "Paid",
            "Dates",
            "Days",
            "Approved",
          ]}
        >
          {data.rows.map((row) => (
            <ReportTableRow key={row.id}>
              <ReportTableCell>
                <Link
                  href={`/people/leave/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.displayName}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {row.employeeNumber}
                  {row.requestNumber ? ` · ${row.requestNumber}` : ""}
                </div>
              </ReportTableCell>
              <ReportTableCell>
                {row.leaveTypeCode}
                <div className="text-xs text-muted-foreground">
                  {row.leaveTypeName}
                </div>
              </ReportTableCell>
              <ReportTableCell>
                <Badge variant={row.isPaid ? "success" : "secondary"}>
                  {row.isPaid ? "Paid" : "Unpaid"}
                </Badge>
              </ReportTableCell>
              <ReportTableCell className="text-xs">
                {row.startDate} → {row.endDate}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {row.requestedQuantity}
              </ReportTableCell>
              <ReportTableCell className="text-xs text-muted-foreground">
                {formatDisplayDate(row.approvedAt, { fallback: "—" })}
              </ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
