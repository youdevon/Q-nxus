import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import type { PriorEmploymentExceptionsReport } from "@/src/modules/reports/data/get-prior-employment-exceptions-report";
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

export function PriorEmploymentExceptionsReportView({
  data,
}: {
  data: PriorEmploymentExceptionsReport;
}) {
  return (
    <ReportLayout
      title="Prior-employment verification exceptions"
      description={`Employees with unverified or missing prior-employer YTD for tax year ${data.taxYear}.`}
      actions={
        <PageActionsEnd>
          <ReportPrintLink
            href={reportPrintHref("/reports/payroll/prior-employment-exceptions")}
          />
          <ReportExportLinks href="/reports/payroll/prior-employment-exceptions/export" />
        </PageActionsEnd>
      }
    >
      <ReportSummaryGrid
        items={[
          { label: "Tax year", value: data.taxYear },
          { label: "Exceptions", value: data.rows.length },
        ]}
      />

      {data.rows.length === 0 ? (
        <ReportEmptyState message="No prior-employment verification exceptions." />
      ) : (
        <ReportTable
          headers={[
            "Employee",
            "Department",
            "Records",
            "Exception",
            "Detail",
          ]}
        >
          {data.rows.map((row) => (
            <ReportTableRow key={row.employeeId}>
              <ReportTableCell>
                <Link
                  href={`/payroll/employees/${row.employeeId}/prior-employment`}
                  className="font-medium hover:underline"
                >
                  {row.displayName}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {row.employeeNumber}
                </div>
              </ReportTableCell>
              <ReportTableCell>{row.departmentName ?? "—"}</ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {row.verifiedCount} / {row.recordCount}
              </ReportTableCell>
              <ReportTableCell>
                <div className="flex flex-wrap gap-1">
                  {row.reasons.map((reason) => (
                    <Badge key={reason} variant="warning">
                      {reason === "UNVERIFIED_RECORDS"
                        ? "Unverified"
                        : reason === "INCOMPLETE_PREVIOUS"
                          ? "Incomplete"
                          : "Unknown status"}
                    </Badge>
                  ))}
                </div>
              </ReportTableCell>
              <ReportTableCell className="text-sm">{row.detail}</ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
