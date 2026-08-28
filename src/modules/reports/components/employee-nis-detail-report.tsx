import Link from "next/link";

import { Input } from "@/components/ui/input";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { formatMoney } from "@/src/lib/format";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import type { EmployeeNisDetailReport } from "@/src/modules/reports/data/get-employee-nis-detail-report";
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

export function EmployeeNisDetailReportView({
  data,
}: {
  data: EmployeeNisDetailReport;
}) {
  const exportHref = `/reports/payroll/nis-detail/export?month=${data.selectedPeriodKey}`;
  const optionKeys = [
    ...new Set([data.selectedPeriodKey, ...data.availablePeriodKeys]),
  ].sort((a, b) => b.localeCompare(a));

  return (
    <ReportLayout
      title="Employee NIS detail"
      description="Per-employee NIS breakdown from posted payslip snapshots for the selected month."
      actions={
        <PageActionsEnd>
          <ReportPrintLink
            href={reportPrintHref("/reports/payroll/nis-detail", {
              month: data.selectedPeriodKey,
            })}
          />
          <ReportExportLinks href={exportHref} />
        </PageActionsEnd>
      }
      filters={
        <form
          method="get"
          action="/reports/payroll/nis-detail"
          className="flex flex-wrap items-end gap-3"
        >
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Month</span>
            <Input
              type="month"
              name="month"
              defaultValue={data.selectedPeriodKey}
              className="w-[11rem]"
              required
            />
          </label>
          <ReportGenerateButton />
          {optionKeys.length > 0 ? (
            <p className="pb-2 text-xs text-muted-foreground">
              Posted months:{" "}
              {optionKeys
                .slice(0, 6)
                .map((key) => formatPayslipPeriodLabel(key) ?? key)
                .join(", ")}
              {optionKeys.length > 6 ? "…" : ""}
            </p>
          ) : null}
        </form>
      }
    >
      {data.rows.length === 0 ? (
        <ReportEmptyState
          message={`No posted payslips for ${data.periodName}.`}
          hint="Choose another month above and click Generate report to refresh."
        />
      ) : (
        <ReportTable
          headers={[
            "Employee",
            "NIS #",
            "Insurable earnings",
            "Class",
            "Weeks",
            "EE NIS",
            "ER NIS",
            "Run",
          ]}
        >
          {data.rows.map((row) => (
            <ReportTableRow key={row.payslipId}>
              <ReportTableCell>
                <Link
                  href={`/payroll/employees/${row.employeeId}`}
                  className="font-medium hover:underline"
                >
                  {row.employeeName}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {row.employeeNumber}
                </div>
              </ReportTableCell>
              <ReportTableCell>{row.nisNumber ?? "—"}</ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {formatMoney(row.insurableEarnings, {
                  currency: row.currency,
                })}
              </ReportTableCell>
              <ReportTableCell>{row.nisClass ?? "—"}</ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {row.contributionWeeks ?? "—"}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {formatMoney(row.nisEmployee, { currency: row.currency })}
              </ReportTableCell>
              <ReportTableCell className="tabular-nums">
                {formatMoney(row.nisEmployer, { currency: row.currency })}
              </ReportTableCell>
              <ReportTableCell className="text-xs">{row.runNumber}</ReportTableCell>
            </ReportTableRow>
          ))}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
