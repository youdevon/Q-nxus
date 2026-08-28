import Link from "next/link";

import { PageActionsEnd } from "@/src/components/layout/page-actions";
import type { PayrollReadinessData } from "@/src/modules/payroll/lib/payroll-readiness-types";
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

export function PayrollReadinessExportReport({
  data,
}: {
  data: PayrollReadinessData;
}) {
  const notReadyRows = data.rows.filter((row) => !row.isReady);

  return (
    <ReportLayout
      title="Payroll readiness export"
      description="Employees who cannot be paid and why. Blocking issues must be resolved before pay-run inclusion; warnings are informational."
      actions={
        <PageActionsEnd>
          <ReportPrintLink href={reportPrintHref("/reports/payroll/readiness")} />
          <ReportExportLinks href="/reports/payroll/readiness/export" />
        </PageActionsEnd>
      }
    >
      <ReportSummaryGrid
        items={[
          { label: "Employees", value: data.rows.length },
          { label: "Ready", value: data.readyCount },
          { label: "Not ready", value: data.notReadyCount },
        ]}
      />

      {notReadyRows.length === 0 ? (
        <ReportEmptyState message="All active employees are payroll-ready." />
      ) : (
        <ReportTable
          headers={[
            "Employee",
            "Department",
            "Category",
            "Blocking issues",
            "Warnings",
          ]}
        >
          {notReadyRows.map((row) => (
            <ReportTableRow key={row.employeeId}>
              <ReportTableCell>
                <Link
                  href={`/payroll/employees/${row.employeeId}`}
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
                {row.workforceCategoryLabel ?? "—"}
              </ReportTableCell>
              <ReportTableCell>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {row.blockingIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </ReportTableCell>
              <ReportTableCell>
                {row.softWarnings.length === 0 ? (
                  "—"
                ) : (
                  <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {row.softWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
