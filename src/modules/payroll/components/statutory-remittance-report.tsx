import { Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import type { StatutoryRemittanceReport } from "@/src/modules/payroll/data/get-statutory-remittance";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import { PayrollNav } from "./payroll-nav";

export function StatutoryRemittanceReport({
  data,
}: {
  data: StatutoryRemittanceReport;
}) {
  const { selectedPeriodKey, availablePeriodKeys, totalsByCurrency, payslipCount } =
    data;
  const periodLabel =
    data.periodName ??
    formatPayslipPeriodLabel(selectedPeriodKey) ??
    selectedPeriodKey;
  const mixed = totalsByCurrency.length > 1;
  const optionKeys = [
    ...new Set([selectedPeriodKey, ...availablePeriodKeys]),
  ].sort((a, b) => b.localeCompare(a));

  return (
    <PageShell size="lg">
      <PayrollNav />

      <PageHeader
        title="Statutory remittance"
        description="PAYE, NIS (employee + employer), and Health Surcharge due for the selected month — summed from posted payslips only. Verify against BIR/NIB filing before payment."
        backHref="/payroll/reports"
        backLabel="Reports"
      />

      <form
        method="get"
        action="/payroll/reports/remittance"
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
              .map((key) => formatPayslipPeriodLabel(key) ?? key)
              .join(", ")}
            {optionKeys.length > 6 ? "…" : ""}
          </p>
        ) : null}
      </form>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-muted-foreground" />
            <SectionHeading>{periodLabel}</SectionHeading>
          </div>
          <span className="text-xs text-muted-foreground">
            {payslipCount} posted payslip{payslipCount === 1 ? "" : "s"}
          </span>
        </div>

        {payslipCount === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No posted payslips for {periodLabel}. Draft runs are not counted.
          </p>
        ) : (
          <div className="space-y-5">
            {mixed ? (
              <p className="text-xs text-muted-foreground">
                Mixed currencies — totals shown per currency. Unlike
                currencies are not summed together.
              </p>
            ) : null}

            {totalsByCurrency.map((total) => (
              <div
                key={total.currency}
                className="rounded-lg border border-border/70 bg-muted/20 px-4 py-4"
              >
                {mixed ? (
                  <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {total.currency}
                  </p>
                ) : null}
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      PAYE (income tax)
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {formatMoney(total.paye, { currency: total.currency })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      NIS — employee
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {formatMoney(total.nisEmployee, {
                        currency: total.currency,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      NIS — employer
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {formatMoney(total.nisEmployer, {
                        currency: total.currency,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Health Surcharge
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {formatMoney(total.health, { currency: total.currency })}
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-border/60 pt-4">
                  <p className="text-xs text-muted-foreground">
                    Total statutory remittance
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatMoney(total.totalRemittance, {
                      currency: total.currency,
                    })}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    PAYE + NIS (employee) + NIS (employer) + Health Surcharge.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
