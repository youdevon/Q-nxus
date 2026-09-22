import Link from "next/link";

import { PageActionsEnd } from "@/src/components/layout/page-actions";
import type { EmployeeFileCompletenessRow } from "@/src/modules/hr/data/get-org-employee-file-completeness";
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

export function MissingDocumentsReportView({
  rows,
}: {
  rows: EmployeeFileCompletenessRow[];
}) {
  return (
    <ReportLayout
      title="Missing employee documents"
      description="Org-wide employee file checklist gaps. Same data as People → Documents → Missing."
      actions={
        <PageActionsEnd>
          <ReportPrintLink href={reportPrintHref("/reports/people/missing-documents")} />
          <ReportExportLinks href="/reports/people/missing-documents/export" />
        </PageActionsEnd>
      }
    >
      <ReportSummaryGrid
        items={[{ label: "Employees incomplete", value: rows.length }]}
      />

      <p className="mb-6 text-sm text-muted-foreground">
        Also available in{" "}
        <Link href="/people/documents/missing" className="underline">
          People → Documents → Missing
        </Link>
        .
      </p>

      {rows.length === 0 ? (
        <ReportEmptyState message="All employee files are complete." />
      ) : (
        <ReportTable
          headers={["Employee", "Department", "Progress", "Missing items"]}
        >
          {rows.map((row) => (
            <ReportTableRow key={row.employeeId}>
              <ReportTableCell>
                <Link
                  href={`/people/employees/${row.employeeId}/documents`}
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
                {row.completeness.completeCount} / {row.completeness.totalCount}
              </ReportTableCell>
              <ReportTableCell>
                {row.completeness.missingLabels.join(", ")}
              </ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
