import Link from "next/link";
import { CalendarRange, CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import type { MonthlyPayrollReportData } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import {
  runKindLabel,
  type PayrollMoneyTotals,
} from "@/src/modules/payroll/lib/payroll-analytics";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import { PayrollNav } from "./payroll-nav";

function formatDate(iso: string | null) {
  if (!iso) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-TT", {
    dateStyle: "medium",
    timeZone: "America/Port_of_Spain",
  }).format(new Date(iso));
}

function MoneyKpis({
  totals,
  mixed,
}: {
  totals: PayrollMoneyTotals[];
  mixed: boolean;
}) {
  if (totals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {mixed ? (
        <p className="text-xs text-muted-foreground">
          Mixed currencies — totals shown per currency. Unlike currencies are
          not summed together.
        </p>
      ) : null}

      {totals.map((total) => (
        <div
          key={total.currency}
          className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label={`Payroll totals ${total.currency}`}
        >
          <div>
            <p className="text-xs text-muted-foreground">
              Gross earnings paid
              {mixed ? ` (${total.currency})` : ""}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.grossPay, { currency: total.currency })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Employee deductions
              {mixed ? ` (${total.currency})` : ""}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.totalDeductions, {
                currency: total.currency,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Net pay
              {mixed ? ` (${total.currency})` : ""}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.netPay, { currency: total.currency })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Employer contributions
              {mixed ? ` (${total.currency})` : ""}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.employerContributions, {
                currency: total.currency,
              })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              e.g. employer NIS from posted snapshots
            </p>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <p className="text-xs text-muted-foreground">
              Total organization payroll cost
              {mixed ? ` (${total.currency})` : ""}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.organizationCost, {
                currency: total.currency,
              })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gross + employer contributions. Bank transfers allocate net pay
              and are not an extra cost.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MonthlyPayrollReport({
  data,
}: {
  data: MonthlyPayrollReportData;
}) {
  const { summary, selectedPeriodKey, availablePeriodKeys } = data;
  const periodLabel =
    summary.periodName ??
    formatPayslipPeriodLabel(selectedPeriodKey) ??
    selectedPeriodKey;
  const mixed = summary.totalsByCurrency.length > 1;
  const optionKeys = [
    ...new Set([selectedPeriodKey, ...availablePeriodKeys]),
  ].sort((a, b) => b.localeCompare(a));

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Monthly payroll"
        description="Posted payslip totals for the selected month. Corrections and off-cycle runs in that period are included and broken out below."
        backHref="/payroll/reports"
        backLabel="Reports"
      />

      <form
        method="get"
        action="/payroll/reports/monthly"
        className="mb-8 flex flex-wrap items-end gap-3"
      >
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Month</span>
          <Input
            type="month"
            name="month"
            defaultValue={selectedPeriodKey}
            className="w-[11rem]"
            required
          />
        </label>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {optionKeys.length > 0 ? (
          <p className="pb-2 text-xs text-muted-foreground">
            Posted months available:{" "}
            {optionKeys
              .slice(0, 6)
              .map(
                (key) => formatPayslipPeriodLabel(key) ?? key,
              )
              .join(", ")}
            {optionKeys.length > 6 ? "…" : ""}
          </p>
        ) : null}
      </form>

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-4 text-muted-foreground" />
            <SectionHeading>{periodLabel}</SectionHeading>
          </div>
          <span className="text-xs text-muted-foreground">
            {summary.payslipCount} payslip
            {summary.payslipCount === 1 ? "" : "s"} · {summary.employeeCount}{" "}
            employee{summary.employeeCount === 1 ? "" : "s"}
          </span>
        </div>

        {summary.payslipCount === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No posted payslips for {periodLabel}. Draft runs and excluded
            employees are not counted.
          </p>
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Posted totals
            </p>
            <div className="mt-3">
              <MoneyKpis totals={summary.totalsByCurrency} mixed={mixed} />
            </div>
          </div>
        )}
      </section>

      {summary.byRunKind.length > 0 ? (
        <section className="mb-10">
          <SectionHeading className="mb-4">By run type</SectionHeading>
          <div className="divide-y divide-border/70">
            {summary.byRunKind.map((item) => (
              <div
                key={`${item.runKind}-${item.currency}`}
                className="grid gap-3 py-4 md:grid-cols-[8rem_1fr_1fr_1fr_1fr]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{runKindLabel(item.runKind)}</Badge>
                  {mixed ? (
                    <span className="text-xs text-muted-foreground">
                      {item.currency}
                    </span>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatMoney(item.grossPay, { currency: item.currency })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatMoney(item.netPay, { currency: item.currency })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Employer</p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatMoney(item.employerContributions, {
                      currency: item.currency,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Slips / people</p>
                  <p className="text-sm font-medium">
                    {item.payslipCount} / {item.employeeCount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {summary.runs.length > 0 ? (
        <section>
          <SectionHeading className="mb-4">Posted runs</SectionHeading>
          <div className="divide-y divide-border/70">
            {summary.runs.map((run) => (
              <div
                key={`${run.payRunId}-${run.currency}`}
                className="grid gap-3 py-5 md:grid-cols-[1fr_7rem_7rem_7rem_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{run.runNumber}</p>
                    <Badge variant="success">
                      <CircleCheck />
                      Posted
                    </Badge>
                    {run.runKind !== "REGULAR" ? (
                      <Badge variant="outline">
                        {runKindLabel(run.runKind)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {run.employeeCount} employee
                    {run.employeeCount === 1 ? "" : "s"} · {run.payslipCount}{" "}
                    payslip{run.payslipCount === 1 ? "" : "s"}
                    {mixed ? ` · ${run.currency}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatMoney(run.grossPay, { currency: run.currency })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatMoney(run.netPay, { currency: run.currency })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Posted</p>
                  <p className="text-sm font-medium">
                    {formatDate(run.postedAt)}
                  </p>
                </div>
                <div className="flex items-center md:justify-end">
                  <Button
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    render={<Link href={`/payroll/runs/${run.payRunId}`} />}
                  >
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
