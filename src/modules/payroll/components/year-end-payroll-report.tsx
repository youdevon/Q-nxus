import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Input } from "@/components/ui/input";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import type { YearEndEmployeeSummary } from "@/src/modules/payroll/data/get-year-end-payroll-summary";
import {
  ReportEmptyState,
  ReportExportLinks,
  ReportGenerateButton,
  ReportPrintLink,
} from "@/src/modules/reports/components/report-layout";
import { reportPrintHref } from "@/src/modules/reports/lib/report-print";
import { PayrollNav } from "./payroll-nav";

export function YearEndPayrollReport({
  year,
  rows,
}: {
  year: number;
  rows: YearEndEmployeeSummary[];
}) {
  return (
    <PageShell size="lg">
      <PayrollNav />
      <PageHeader
        title="Year-end payroll summaries"
        description="Printable annual employee totals from posted payslips only. Use these totals for TD4 / annual summary preparation."
        backHref="/reports"
        backLabel="Reports"
        actions={
          <PageActionsEnd>
            <ReportPrintLink
              href={reportPrintHref("/payroll/reports/year-end", { year: String(year) })}
            />
            <ReportExportLinks
              href={`/payroll/reports/year-end/export?year=${year}`}
            />
          </PageActionsEnd>
        }
      />

      <form
        method="get"
        action="/payroll/reports/year-end"
        className="mb-8 flex flex-wrap items-end gap-3 print:hidden"
      >
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Tax year</span>
          <Input
            type="number"
            name="year"
            min="2000"
            max="2100"
            defaultValue={year}
            className="w-[8rem]"
            required
          />
        </label>
        <ReportGenerateButton />
        <span className="pb-2 text-xs text-muted-foreground">
          Open Print for a clean document layout.
        </span>
      </form>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <SectionHeading>{year} employee summaries</SectionHeading>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Employee</th>
                <th className="py-2 pr-3 text-right font-medium">Gross</th>
                <th className="py-2 pr-3 text-right font-medium">PAYE</th>
                <th className="py-2 pr-3 text-right font-medium">NIS</th>
                <th className="py-2 pr-3 text-right font-medium">Health</th>
                <th className="py-2 pr-3 text-right font-medium">Deductions</th>
                <th className="py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.employeeId}-${row.currency}`} className="border-b border-border/50">
                  <td className="py-2 pr-3">
                    <p className="font-medium">{row.employeeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.employeeNumber} · {row.currency}
                    </p>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatMoney(row.grossPay)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatMoney(row.paye)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatMoney(row.nisEmployee)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatMoney(row.healthSurcharge)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatMoney(row.totalDeductions)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(row.netPay)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <ReportEmptyState
            message={`No posted payslips found for ${year}.`}
            hint="Choose another tax year above and click Generate report to refresh."
          />
        ) : null}
      </section>
    </PageShell>
  );
}
