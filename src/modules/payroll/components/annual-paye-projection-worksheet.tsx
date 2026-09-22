import Link from "next/link";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/src/components/ui/section-heading";
import { formatMoney } from "@/src/lib/format";
import type { AnnualPayeProjectionResult } from "@/src/modules/payroll/lib/annual-paye-projection";

function MetaBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function money(value: number, currency: string): string {
  return formatMoney(value, { currency });
}

export function AnnualPayeProjectionWorksheet({
  projection,
  currency,
  payeConfigVersionLabel,
  isMidYearJoiner = false,
  printHref,
}: {
  projection: AnnualPayeProjectionResult;
  currency: string;
  payeConfigVersionLabel: string | null;
  /** When true, show mid-year joiner method callout. */
  isMidYearJoiner?: boolean;
  /** Opens the printable projection worksheet (uses printer paper size). */
  printHref?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <SectionHeading>Annual PAYE projection</SectionHeading>
          <p className="text-sm text-muted-foreground">
            {isMidYearJoiner ? (
              <>
                Mid-year joiner method: prior taxable YTD + this-employer YTD +
                projected remaining earnings, less personal allowance and
                qualifying deductions, then credit PAYE already paid and spread
                the balance over remaining pay periods.
              </>
            ) : (
              <>
                Calendar-year earnings and estimated PAYE position. Actual YTD is
                from posted payslips; remaining earnings are projected and are{" "}
                <span className="font-medium text-foreground">not</span> treated
                as salary already paid.
              </>
            )}
            {payeConfigVersionLabel
              ? ` Statutory schedule: ${payeConfigVersionLabel}.`
              : null}{" "}
            Org rates change via Payroll → Settings → PAYE (new effective-dated
            version). Employee formula overrides use approved tax-year adjustments.
          </p>
        </div>
        {printHref ? (
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            className="shrink-0"
            render={<Link href={printHref} />}
          >
            <Printer />
            Print projection
          </Button>
        ) : null}
      </div>

      {projection.warnings.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          {projection.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetaBlock
          label="Remaining periods"
          value={String(projection.periods.remainingPeriods)}
          hint={`${projection.periods.payFrequency} · as of ${projection.periods.asOfDate}`}
        />
        <MetaBlock
          label="Projected annual taxable"
          value={money(projection.projectedAnnual.taxableEarnings, currency)}
        />
        <MetaBlock
          label="Projected annual tax"
          value={money(projection.projectedAnnualTaxLiability, currency)}
        />
        <MetaBlock
          label="Recommended PAYE / period"
          value={
            projection.recommendedPayePerPeriod != null
              ? money(projection.recommendedPayePerPeriod, currency)
              : "—"
          }
          hint="Preview only — does not alter payroll"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 text-right font-medium">Taxable</th>
              <th className="px-3 py-2 text-right font-medium">PAYE</th>
              <th className="px-3 py-2 text-right font-medium">Employee NIS</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-3 py-2.5">
                Previous employer{" "}
                <span className="text-xs text-muted-foreground">(actual)</span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(projection.previousEmployer.taxableEarnings, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(projection.previousEmployerPaye, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(projection.previousEmployer.employeeNis, currency)}
              </td>
            </tr>
            <tr className="border-b">
              <td className="px-3 py-2.5">
                Current employer YTD{" "}
                <span className="text-xs text-muted-foreground">(actual)</span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(
                  projection.currentEmployerActual.taxableEarnings,
                  currency,
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(projection.currentEmployerPaye, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(projection.currentEmployerActual.employeeNis, currency)}
              </td>
            </tr>
            <tr className="border-b bg-muted/10">
              <td className="px-3 py-2.5">
                Projected remaining{" "}
                <span className="text-xs text-muted-foreground">(not paid)</span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(projection.projectedRemaining.taxableEarnings, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                —
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(projection.projectedRemaining.employeeNis, currency)}
              </td>
            </tr>
            <tr className="border-b font-medium">
              <td className="px-3 py-2.5">Projected calendar-year total</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(projection.projectedAnnual.taxableEarnings, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                —
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(projection.projectedAnnual.employeeNis, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border/70 px-4 py-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tax calculation
        </p>
        <dl className="mt-3 space-y-1.5 tabular-nums">
          <div className="flex justify-between gap-4">
            <dt>Projected annual taxable earnings</dt>
            <dd>{money(projection.projectedAnnual.taxableEarnings, currency)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <dt>Less personal allowance</dt>
            <dd>({money(projection.personalAllowance, currency)})</dd>
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <dt>
              Less qualifying deductions
              {projection.qualifying.capped ? " (capped)" : ""}
            </dt>
            <dd>
              (
              {money(
                projection.qualifying.allowableQualifyingDeduction,
                currency,
              )}
              )
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border/60 pt-2 font-medium">
            <dt>Projected chargeable income</dt>
            <dd>{money(projection.projectedChargeableIncome, currency)}</dd>
          </div>
          {projection.taxByBand.map((band) => (
            <div
              key={band.ratePercent}
              className="flex justify-between gap-4 text-muted-foreground"
            >
              <dt>Tax at {band.ratePercent}%</dt>
              <dd>{money(band.taxAmount, currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-border/60 pt-2 font-medium">
            <dt>Projected annual tax liability</dt>
            <dd>{money(projection.projectedAnnualTaxLiability, currency)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <dt>Less previous-employer PAYE</dt>
            <dd>({money(projection.previousEmployerPaye, currency)})</dd>
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <dt>Less current-employer PAYE</dt>
            <dd>({money(projection.currentEmployerPaye, currency)})</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border/60 pt-2 font-medium">
            <dt>Remaining projected PAYE liability</dt>
            <dd>{money(projection.remainingTaxLiability, currency)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Remaining payroll periods</dt>
            <dd>{projection.periods.remainingPeriods}</dd>
          </div>
          <div className="flex justify-between gap-4 font-medium">
            <dt>Recommended PAYE per remaining period</dt>
            <dd>
              {projection.recommendedPayePerPeriod != null
                ? money(projection.recommendedPayePerPeriod, currency)
                : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
