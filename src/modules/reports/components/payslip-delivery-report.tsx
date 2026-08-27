import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { formatDisplayDate } from "@/src/lib/format";
import type { PayslipDeliveryReport } from "@/src/modules/reports/data/get-payslip-delivery-report";
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

function issueLabel(issue: string): string {
  switch (issue) {
    case "UNRELEASED":
      return "Unreleased";
    case "EMAIL_PENDING":
      return "Email pending";
    case "EMAIL_FAILED":
      return "Email failed";
    default:
      return issue;
  }
}

export function PayslipDeliveryReportView({
  data,
}: {
  data: PayslipDeliveryReport;
}) {
  return (
    <ReportLayout
      title="Payslip delivery status"
      description="Posted payslips not yet released to employees or with pending/failed email delivery."
      actions={
        <PageActionsEnd>
          <ReportPrintLink href={reportPrintHref("/reports/payroll/payslip-delivery")} />
          <ReportExportLinks href="/reports/payroll/payslip-delivery/export" />
        </PageActionsEnd>
      }
    >
      <ReportSummaryGrid
        items={[
          { label: "Unreleased", value: data.summary.unreleased },
          { label: "Email pending", value: data.summary.emailPending },
          { label: "Email failed", value: data.summary.emailFailed },
        ]}
      />

      {data.rows.length === 0 ? (
        <ReportEmptyState message="All posted payslips are released and delivered." />
      ) : (
        <ReportTable
          headers={[
            "Employee",
            "Period",
            "Run",
            "Issue",
            "Email status",
            "Posted",
          ]}
        >
          {data.rows.map((row) => (
            <ReportTableRow key={row.payslipId}>
              <ReportTableCell>
                <Link
                  href={`/payroll/employees/${row.employeeId}/payslip`}
                  className="font-medium hover:underline"
                >
                  {row.employeeName}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {row.employeeNumber}
                </div>
              </ReportTableCell>
              <ReportTableCell>{row.periodKey}</ReportTableCell>
              <ReportTableCell>{row.runNumber}</ReportTableCell>
              <ReportTableCell>
                <Badge
                  variant={
                    row.issue === "EMAIL_FAILED" || row.issue === "UNRELEASED"
                      ? "warning"
                      : "secondary"
                  }
                >
                  {issueLabel(row.issue)}
                </Badge>
              </ReportTableCell>
              <ReportTableCell>{row.emailDeliveryStatus ?? "—"}</ReportTableCell>
              <ReportTableCell className="text-xs text-muted-foreground">
                {formatDisplayDate(row.postedAt, { fallback: "—" })}
              </ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
