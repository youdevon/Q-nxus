import Link from "next/link";
import { UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import { buildListFilterUrl } from "@/src/lib/list-filter-url";
import type { EmployeePaymentHistoryReportData } from "@/src/modules/payroll/data/get-employee-payment-history";
import {
  runKindLabel,
  type PayrollMoneyTotals,
} from "@/src/modules/payroll/lib/payroll-analytics";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import { PayrollNav } from "./payroll-nav";

const PRESETS = [
  { value: "this_year", label: "This year" },
  { value: "previous_year", label: "Previous year" },
  { value: "last_3", label: "Last 3 months" },
  { value: "last_6", label: "Last 6 months" },
  { value: "last_12", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
] as const;

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
          Mixed currencies — totals shown per currency.
        </p>
      ) : null}
      {totals.map((total) => (
        <div
          key={total.currency}
          className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <p className="text-xs text-muted-foreground">Gross paid</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.grossPay, { currency: total.currency })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deductions</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.totalDeductions, {
                currency: total.currency,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net paid</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.netPay, { currency: total.currency })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Employer contribution
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.employerContributions, {
                currency: total.currency,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Org cost (gross + employer)</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(total.organizationCost, {
                currency: total.currency,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmployeePaymentHistoryReport({
  data,
}: {
  data: EmployeePaymentHistoryReportData;
}) {
  const { period, selectedEmployee, history, matches, query } = data;
  const mixed = (history?.totalsByCurrency.length ?? 0) > 1;
  const periodLabel = `${formatPayslipPeriodLabel(period.startPeriodKey) ?? period.startPeriodKey} – ${formatPayslipPeriodLabel(period.endPeriodKey) ?? period.endPeriodKey}`;

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Employee payment history"
        description="Posted amounts paid to one employee over a selected period. Corrections and off-cycle runs are included and labeled."
        backHref="/payroll/reports"
        backLabel="Reports"
      />

      <form
        method="get"
        action="/payroll/reports/employee"
        className="mb-8 space-y-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-4"
      >
        {selectedEmployee ? (
          <input type="hidden" name="employeeId" value={selectedEmployee.id} />
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Find employee</span>
            <Input
              type="search"
              name="query"
              defaultValue={query}
              placeholder="Name or employee number"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="outline">
              Search
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Period</span>
            <select
              name="preset"
              defaultValue={period.preset}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Start month</span>
            <Input
              type="month"
              name="start"
              defaultValue={period.startPeriodKey}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">End month</span>
            <Input
              type="month"
              name="end"
              defaultValue={period.endPeriodKey}
            />
          </label>
          <div className="flex items-end">
            <Button type="submit">Apply period</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Presets ignore custom months unless “Custom range” is selected. Month
          ranges are inclusive.
        </p>
      </form>

      {!selectedEmployee && query.trim() ? (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="size-4 text-muted-foreground" />
            <SectionHeading>Matching employees</SectionHeading>
          </div>
          {matches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No employees match “{query.trim()}”.
            </p>
          ) : (
            <div className="divide-y divide-border/70">
              {matches.map((match) => (
                <Link
                  key={match.id}
                  href={buildListFilterUrl("/payroll/reports/employee", {
                    employeeId: match.id,
                    query: query || undefined,
                    preset: period.preset,
                    start: period.startPeriodKey,
                    end: period.endPeriodKey,
                  })}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 transition-colors hover:bg-muted/30"
                >
                  <div>
                    <p className="font-medium">{match.displayName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {match.employeeNumber}
                      {match.departmentName
                        ? ` · ${match.departmentName}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">Select</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!selectedEmployee && !query.trim() ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Search for an employee to view posted payment history.
        </p>
      ) : null}

      {selectedEmployee ? (
        <section>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <UserRound className="size-4 text-muted-foreground" />
                <SectionHeading>{selectedEmployee.displayName}</SectionHeading>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedEmployee.employeeNumber}
                {selectedEmployee.departmentName
                  ? ` · ${selectedEmployee.departmentName}`
                  : ""}
                {" · "}
                {periodLabel}
              </p>
            </div>
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={
                <Link
                  href={buildListFilterUrl("/payroll/reports/employee", {
                    query: query || undefined,
                    preset: period.preset,
                    start: period.startPeriodKey,
                    end: period.endPeriodKey,
                  })}
                />
              }
            >
              Change employee
            </Button>
          </div>

          {!history || history.payslipCount === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No posted payslips for this employee in {periodLabel}. Draft and
              excluded slips are not counted.
            </p>
          ) : (
            <>
              <div className="mb-8 rounded-lg border border-border/70 bg-muted/20 px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Period totals
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {history.payslipCount} payslip
                    {history.payslipCount === 1 ? "" : "s"} · {history.runCount}{" "}
                    run{history.runCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-3">
                  <MoneyKpis
                    totals={history.totalsByCurrency}
                    mixed={mixed}
                  />
                </div>
              </div>

              {history.byRunKind.some((item) => item.runKind !== "REGULAR") ? (
                <div className="mb-8">
                  <SectionHeading className="mb-3">By run type</SectionHeading>
                  <div className="flex flex-wrap gap-2">
                    {history.byRunKind.map((item) => (
                      <Badge
                        key={`${item.runKind}-${item.currency}`}
                        variant="outline"
                      >
                        {runKindLabel(item.runKind)}
                        {mixed ? ` (${item.currency})` : ""}:{" "}
                        {formatMoney(item.grossPay, {
                          currency: item.currency,
                        })}{" "}
                        gross · {item.payslipCount} slip
                        {item.payslipCount === 1 ? "" : "s"}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <SectionHeading className="mb-4">Monthly breakdown</SectionHeading>
              <div className="divide-y divide-border/70">
                {history.months.map((month) => (
                  <div key={month.periodKey} className="py-5">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{month.periodName}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {month.totalsByCurrency.map((total) => (
                          <span key={total.currency}>
                            {formatMoney(total.netPay, {
                              currency: total.currency,
                            })}{" "}
                            net
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {month.payslips.map((slip) => (
                        <div
                          key={slip.payslipId}
                          className="grid gap-3 md:grid-cols-[1fr_7rem_7rem_7rem_auto]"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">
                                {slip.runNumber}
                              </p>
                              {slip.runKind !== "REGULAR" ? (
                                <Badge variant="outline">
                                  {runKindLabel(slip.runKind)}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {slip.currency}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Gross</p>
                            <p className="text-sm font-medium tabular-nums">
                              {formatMoney(slip.grossPay, {
                                currency: slip.currency,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Net</p>
                            <p className="text-sm font-medium tabular-nums">
                              {formatMoney(slip.netPay, {
                                currency: slip.currency,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Employer
                            </p>
                            <p className="text-sm font-medium tabular-nums">
                              {formatMoney(slip.employerContributions, {
                                currency: slip.currency,
                              })}
                            </p>
                          </div>
                          <div className="flex items-center md:justify-end">
                            <Button
                              nativeButton={false}
                              size="sm"
                              variant="outline"
                              render={
                                <Link
                                  href={`/payroll/runs/${slip.payRunId}/payslips/${slip.payslipId}`}
                                />
                              }
                            >
                              Payslip
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}
    </PageShell>
  );
}
