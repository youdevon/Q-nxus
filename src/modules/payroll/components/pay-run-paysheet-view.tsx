import Link from "next/link";
import { Printer } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { formatMoney } from "@/src/lib/format";
import type { PayRunPaysheetData } from "@/src/modules/payroll/data/get-pay-run-paysheet";
import { payRunStatusBadgeVariant } from "@/src/config/ui-colors";
import {
  ReportExportLinks,
  ReportLayout,
} from "@/src/modules/reports/components/report-layout";

function money(amount: number, currency: string) {
  return formatMoney(amount, { currency });
}

const employerKpiClass =
  "rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2";
const employerKpiLabelClass =
  "text-[10px] font-medium uppercase tracking-wide text-sky-800 dark:text-sky-200/90";
const employerThClass =
  "border-l border-sky-500/25 bg-sky-500/15 px-3 py-2.5 text-right font-medium text-sky-900 dark:text-sky-100";
const employerTdClass =
  "border-l border-sky-500/20 bg-sky-500/8 px-3 py-2.5 text-right tabular-nums text-sky-950 dark:bg-sky-950/25 dark:text-sky-50";
const nisTotalThClass =
  "bg-sky-500/20 px-3 py-2.5 text-right font-semibold text-sky-900 dark:text-sky-100";
const nisTotalTdClass =
  "bg-sky-500/12 px-3 py-2.5 text-right tabular-nums font-medium text-sky-950 dark:bg-sky-950/35 dark:text-sky-50";

export function PayRunPaysheetView({ data }: { data: PayRunPaysheetData }) {
  const { currency, totals } = data;
  const base = `/payroll/runs/${data.payRunId}/paysheet`;
  const kindLabel =
    data.runKind === "CORRECTION"
      ? "Correction"
      : data.runKind === "OFF_CYCLE"
        ? "Off-cycle"
        : "Regular";

  const summaryItems = [
    { label: "Gross", value: money(totals.grossPay, currency), employer: false },
    { label: "PAYE", value: money(totals.paye, currency), employer: false },
    {
      label: "NIS (ee)",
      value: money(totals.nisEmployee, currency),
      employer: false,
    },
    {
      label: "Health",
      value: money(totals.healthSurcharge, currency),
      employer: false,
    },
    {
      label: "Other deductions",
      value: money(totals.otherDeductions, currency),
      employer: false,
    },
    {
      label: "Total deductions",
      value: money(totals.totalDeductions, currency),
      employer: false,
    },
    { label: "Net pay", value: money(totals.netPay, currency), employer: false },
    {
      label: "NIS (er)",
      value: money(totals.nisEmployer, currency),
      employer: true,
    },
    {
      label: "NIS payment",
      value: money(totals.nisPayment, currency),
      employer: true,
    },
  ] as const;

  return (
    <ReportLayout
      title={`Payroll register · ${data.runNumber}`}
      description={`${data.periodName} · ${kindLabel} · ${data.includedCount} employee${data.includedCount === 1 ? "" : "s"}`}
      backHref={`/payroll/runs/${data.payRunId}`}
      backLabel="Pay run"
      actions={
        <PageActionsEnd>
          <Badge variant={payRunStatusBadgeVariant(data.status)}>
            {data.statusLabel}
          </Badge>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href={`${base}/print`} target="_blank" />}
          >
            <Printer />
            Print
          </Button>
          <ReportExportLinks href={`${base}/export`} />
        </PageActionsEnd>
      }
    >
      {data.isPreview ? (
        <p className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          This is a <span className="font-medium text-foreground">preview</span>{" "}
          payroll register for review before approval or posting. Amounts update
          when you calculate the paysheet.
        </p>
      ) : null}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-md border border-border/70 bg-muted/20 px-3 py-2",
              item.employer && employerKpiClass,
            )}
          >
            <p
              className={cn(
                "text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                item.employer && employerKpiLabelClass,
              )}
            >
              {item.label}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No included employees yet. Open the pay run and calculate the
          paysheet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/70">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Emp #</th>
                <th className="px-3 py-2.5 font-medium">Employee</th>
                <th className="px-3 py-2.5 font-medium">Department</th>
                <th className="px-3 py-2.5 text-right font-medium">Basic</th>
                <th className="px-3 py-2.5 text-right font-medium">Allowances</th>
                <th className="px-3 py-2.5 text-right font-medium">Gross</th>
                <th className="px-3 py-2.5 text-right font-medium">PAYE</th>
                <th className="px-3 py-2.5 text-right font-medium">NIS (ee)</th>
                <th className="px-3 py-2.5 text-right font-medium">Health</th>
                <th className="px-3 py-2.5 text-right font-medium">Other</th>
                <th className="px-3 py-2.5 text-right font-medium">Deductions</th>
                <th className="px-3 py-2.5 text-right font-medium">Net</th>
                <th className={employerThClass}>NIS (er)</th>
                <th className={nisTotalThClass}>NIS payment</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={`${row.employeeNumber}-${row.employeeName}`}
                  className="border-b border-border/60 align-top"
                >
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {row.employeeNumber}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{row.employeeName}</div>
                    {row.jobTitle ? (
                      <div className="text-xs text-muted-foreground">
                        {row.jobTitle}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.departmentName ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(row.baseSalary, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(row.allowancesTotal, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(row.grossPay, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(row.paye, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(row.nisEmployee, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(row.healthSurcharge, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(row.otherDeductions, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(row.totalDeductions, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    {money(row.netPay, currency)}
                  </td>
                  <td className={employerTdClass}>
                    {money(row.nisEmployer, currency)}
                  </td>
                  <td className={nisTotalTdClass}>
                    {money(row.nisPayment, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-3 py-2.5" colSpan={3}>
                  Total
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals.baseSalary, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals.allowancesTotal, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals.grossPay, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals.paye, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals.nisEmployee, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals.healthSurcharge, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals.otherDeductions, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals.totalDeductions, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals.netPay, currency)}
                </td>
                <td className={cn(employerTdClass, "font-semibold")}>
                  {money(totals.nisEmployer, currency)}
                </td>
                <td className={cn(nisTotalTdClass, "font-semibold")}>
                  {money(totals.nisPayment, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data.excludedRows.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold">Excluded employees</h2>
          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Emp #</th>
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.excludedRows.map((row) => (
                  <tr
                    key={`ex-${row.employeeNumber}`}
                    className="border-b border-border/60"
                  >
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {row.employeeNumber}
                    </td>
                    <td className="px-3 py-2">{row.employeeName}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.exclusionReason ?? "Excluded"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </ReportLayout>
  );
}
