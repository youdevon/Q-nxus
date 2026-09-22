import Link from "next/link";
import { CircleAlert, CircleCheck, CircleDollarSign } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  ListSearchFilters,
  type ActiveFilterChip,
} from "@/src/components/list-search-filters";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/src/lib/format";
import { BOARD_MEMBER_UI } from "@/src/modules/hr/lib/workforce-category";
import {
  PAY_RUN_PAYEE_GROUP_OPTIONS,
  payRunPayeeGroupLabel,
} from "@/src/modules/payroll/lib/pay-run-payee-group";
import type {
  PayrollSalariesData,
  PayrollSalariesFilters,
  PayrollSalaryRow,
} from "@/src/modules/payroll/lib/payroll-salaries-types";
import { PayrollNav } from "./payroll-nav";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Aggregate base, allowances, gross, and taxable pay for listed rows. */
function summarizeListedSalaries(rows: PayrollSalaryRow[]) {
  const byCurrency = new Map<
    string,
    {
      baseSalary: number;
      monthlyAllowances: number;
      grossPay: number;
      taxablePay: number;
    }
  >();

  for (const row of rows) {
    if (
      row.baseSalary == null &&
      row.monthlyAllowances == null &&
      row.grossPay == null &&
      row.monthlyTaxableEarnings == null
    ) {
      continue;
    }

    const currency = row.currency ?? "TTD";
    const current = byCurrency.get(currency) ?? {
      baseSalary: 0,
      monthlyAllowances: 0,
      grossPay: 0,
      taxablePay: 0,
    };

    if (row.baseSalary != null) {
      current.baseSalary += row.baseSalary;
    }
    if (row.monthlyAllowances != null) {
      current.monthlyAllowances += row.monthlyAllowances;
    }
    if (row.grossPay != null) {
      current.grossPay += row.grossPay;
    }
    if (row.monthlyTaxableEarnings != null) {
      current.taxablePay += row.monthlyTaxableEarnings;
    }

    byCurrency.set(currency, current);
  }

  return [...byCurrency.entries()]
    .map(([currency, amounts]) => ({
      currency,
      baseSalary: roundMoney(amounts.baseSalary),
      monthlyAllowances: roundMoney(amounts.monthlyAllowances),
      grossPay: roundMoney(amounts.grossPay),
      taxablePay: roundMoney(amounts.taxablePay),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function PayrollSalariesDirectory({
  data,
  filters,
  canManage,
}: {
  data: PayrollSalariesData;
  filters: PayrollSalariesFilters;
  canManage: boolean;
}) {
  const filterValues = {
    query: filters.query,
    payeeGroup: filters.payeeGroup,
  };
  const salaryTotals = summarizeListedSalaries(data.rows);
  const hasMixedCurrencies = salaryTotals.length > 1;
  const isFiltered = Boolean(
    filters.query?.trim() || filters.payeeGroup,
  );
  const selectedGroupLabel = payRunPayeeGroupLabel(filters.payeeGroup);

  const chips: ActiveFilterChip[] = [];
  if (filters.payeeGroup && selectedGroupLabel) {
    chips.push({
      key: "payeeGroup",
      value: filters.payeeGroup,
      label: `Group: ${selectedGroupLabel}`,
    });
  }

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Salaries"
        description="Current contract pay for active employees, board members, and other payees. Filter by payee group to match how pay runs are split. Master pay data — not posted payroll history."
        backHref="/payroll"
        backLabel="Payroll"
      />

      <ListSearchFilters
        basePath="/payroll/salaries"
        clearHref="/payroll/salaries"
        searchPlaceholder="Name or reference number"
        searchValue={filters.query ?? ""}
        values={filterValues}
        chips={chips}
        fields={[
          {
            type: "checkbox",
            name: "payeeGroup",
            label: "Payee group",
            options: PAY_RUN_PAYEE_GROUP_OPTIONS.map((option) => {
              const count =
                data.groupCounts.find((row) => row.value === option.value)
                  ?.count ?? 0;
              return {
                value: option.value,
                label: `${option.label} (${count})`,
              };
            }),
          },
        ]}
      />

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="size-4 text-muted-foreground" />
            <SectionHeading>
              {selectedGroupLabel
                ? `${selectedGroupLabel} roster`
                : "Pay roster"}
            </SectionHeading>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.totalCount}{" "}
            {data.totalCount === 1 ? "person" : "people"}
            {isFiltered ? " matching filters" : ""}
          </span>
        </div>

        {!filters.payeeGroup && data.groupCounts.some((g) => g.count > 0) ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {data.groupCounts
              .filter((group) => group.count > 0)
              .map((group) => (
                <Link
                  key={group.value}
                  href={`/payroll/salaries?payeeGroup=${group.value}`}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                    group.value === "BOARD"
                      ? BOARD_MEMBER_UI.badge
                      : "border-border/70 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  {group.label}: {group.count}
                </Link>
              ))}
          </div>
        ) : null}

        {data.rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {isFiltered
              ? "No payees match your filters."
              : "No active payees found."}
          </p>
        ) : (
          <>
            {salaryTotals.length > 0 ? (
              <div
                className="mb-6 rounded-lg border border-border/70 bg-muted/20 px-4 py-4"
                aria-label="Pay totals for listed people"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Listed totals
                    {selectedGroupLabel ? ` · ${selectedGroupLabel}` : ""}
                  </p>
                  {hasMixedCurrencies ? (
                    <p className="text-xs text-muted-foreground">
                      Mixed currencies — sums shown per currency
                    </p>
                  ) : null}
                </div>

                <div className="mt-3 space-y-4">
                  {salaryTotals.map((total) => (
                    <div
                      key={total.currency}
                      className="grid gap-x-8 gap-y-3 sm:max-w-4xl sm:grid-cols-2 lg:grid-cols-4"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total base pay
                          {hasMixedCurrencies ? ` (${total.currency})` : ""}
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">
                          {formatMoney(total.baseSalary, {
                            currency: total.currency,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total allowances
                          {hasMixedCurrencies ? ` (${total.currency})` : ""}
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">
                          {formatMoney(total.monthlyAllowances, {
                            currency: total.currency,
                          })}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          / month
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total gross pay
                          {hasMixedCurrencies ? ` (${total.currency})` : ""}
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">
                          {formatMoney(total.grossPay, {
                            currency: total.currency,
                          })}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          / month
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total taxable pay
                          {hasMixedCurrencies ? ` (${total.currency})` : ""}
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">
                          {formatMoney(total.taxablePay, {
                            currency: total.currency,
                          })}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          / month
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="divide-y divide-border/70">
              <div className="hidden gap-4 border-b border-border/70 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid md:grid-cols-[minmax(12rem,1.4fr)_9rem_8rem_7rem_7rem_7rem_7rem_auto]">
                <span>Person</span>
                <span>Department / role</span>
                <span>Pay frequency</span>
                <span className="text-right">Base pay</span>
                <span className="text-right">Allowances</span>
                <span className="text-right">Gross pay</span>
                <span className="text-right">Taxable pay</span>
                <span className="sr-only">Actions</span>
              </div>

              {data.rows.map((row) => {
                const setupHref = `/payroll/employees/${row.employeeId}`;
                const payslipHref = `${setupHref}/payslip?from=salaries`;
                const currency = row.currency ?? "TTD";
                const isBoard = row.workforceCategory === "BOARD";

                return (
                  <div
                    key={row.employeeId}
                    className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,1.4fr)_9rem_8rem_7rem_7rem_7rem_7rem_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{row.displayName}</p>
                        {isBoard ? (
                          <Badge
                            variant="outline"
                            className={BOARD_MEMBER_UI.badge}
                          >
                            Board
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="outline">
                              {row.employeeNumber}
                            </Badge>
                            {row.workforceCategoryLabel ? (
                              <Badge variant="outline">
                                {row.workforceCategoryLabel}
                              </Badge>
                            ) : null}
                          </>
                        )}
                        {row.isReady ? (
                          <Badge variant="success">
                            <CircleCheck />
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            <CircleAlert />
                            Not ready
                          </Badge>
                        )}
                      </div>
                      {!row.hasCurrentContract ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          No current active contract
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground md:hidden">
                        Department / role
                      </p>
                      <p className="mt-1 text-sm font-medium md:mt-0">
                        {isBoard
                          ? (row.positionTitle ?? "Board member")
                          : (row.departmentName ?? "Unassigned")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isBoard
                          ? (row.departmentName ?? "No department")
                          : (row.positionTitle ?? "No position")}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground md:hidden">
                        Pay frequency
                      </p>
                      <p className="mt-1 text-sm font-medium md:mt-0">
                        {row.payFrequency ? label(row.payFrequency) : "Not set"}
                      </p>
                      {row.currency ? (
                        <p className="text-xs text-muted-foreground">
                          {row.currency}
                        </p>
                      ) : null}
                    </div>

                    <div className="md:text-right">
                      <p className="text-xs text-muted-foreground md:hidden">
                        Base pay
                      </p>
                      <p className="mt-1 text-sm font-medium tabular-nums md:mt-0">
                        {row.baseSalary != null
                          ? formatMoney(row.baseSalary, { currency })
                          : "—"}
                      </p>
                    </div>

                    <div className="md:text-right">
                      <p className="text-xs text-muted-foreground md:hidden">
                        Allowances
                      </p>
                      <p className="mt-1 text-sm font-medium tabular-nums md:mt-0">
                        {row.monthlyAllowances != null
                          ? formatMoney(row.monthlyAllowances, {
                              currency,
                            })
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">/ month</p>
                    </div>

                    <div className="md:text-right">
                      <p className="text-xs text-muted-foreground md:hidden">
                        Gross pay
                      </p>
                      <p className="mt-1 text-sm font-medium tabular-nums md:mt-0">
                        {row.grossPay != null
                          ? formatMoney(row.grossPay, {
                              currency,
                            })
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">/ month</p>
                    </div>

                    <div className="md:text-right">
                      <p className="text-xs text-muted-foreground md:hidden">
                        Taxable pay
                      </p>
                      <p className="mt-1 text-sm font-medium tabular-nums md:mt-0">
                        {row.monthlyTaxableEarnings != null
                          ? formatMoney(row.monthlyTaxableEarnings, {
                              currency,
                            })
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">/ month</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                      <Link
                        href={payslipHref}
                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        View payslip
                      </Link>
                      {canManage ? (
                        <Link
                          href={setupHref}
                          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Setup
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </PageShell>
  );
}
