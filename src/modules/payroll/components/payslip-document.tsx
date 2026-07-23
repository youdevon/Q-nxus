import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

import { formatMoney } from "@/src/lib/format";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import {
  notesForPayslipDisplay,
  type PayslipLineItem,
  type PayslipPreview,
} from "@/src/modules/payroll/lib/payslip-preview";
import type { PayslipYtdBreakdown, PayslipYtdTotals } from "@/src/modules/payroll/lib/payslip-ytd";
import type { ProjectedTaxYearPosition } from "@/src/modules/payroll/lib/projected-tax-year-position";

function Amount({
  amount,
  currency,
  showCurrency = false,
  className = "",
}: {
  amount: number;
  currency: string;
  showCurrency?: boolean;
  className?: string;
}) {
  return (
    <span className={`tabular-nums ${className}`}>
      {formatMoney(amount, showCurrency ? { currency } : undefined)}
    </span>
  );
}

function YtdMetricStrip({
  currency,
  metrics,
}: {
  currency: string;
  metrics: Array<{ label: string; amount: number }>;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground print:gap-x-2 print:text-[9px]">
      {metrics.map((metric) => (
        <span key={metric.label}>
          {metric.label}{" "}
          <span className="font-medium text-foreground">
            {formatMoney(metric.amount, { currency })}
          </span>
        </span>
      ))}
    </div>
  );
}

function YtdSection({
  currency,
  ytd,
  ytdBreakdown,
}: {
  currency: string;
  ytd: PayslipYtdTotals;
  ytdBreakdown?: PayslipYtdBreakdown | null;
}) {
  const showSplit =
    ytdBreakdown != null && ytdBreakdown.prior.recordCount > 0;

  if (!showSplit || !ytdBreakdown) {
    if (ytd.periodCount <= 0) {
      return null;
    }

    return (
      <section className="border-b border-border/70 px-3 py-2 sm:px-4 print:px-2.5 print:py-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 print:gap-y-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
            Year to date · {ytd.year}
            <span className="ml-1.5 font-normal normal-case tracking-normal">
              ({ytd.periodCount} period{ytd.periodCount === 1 ? "" : "s"})
            </span>
          </p>
          <YtdMetricStrip
            currency={currency}
            metrics={[
              { label: "Gross", amount: ytd.grossPay },
              { label: "Deductions", amount: ytd.totalDeductions },
              { label: "PAYE", amount: ytd.paye },
              { label: "NIS", amount: ytd.nisEmployee },
              { label: "Health", amount: ytd.healthSurcharge },
              { label: "Net", amount: ytd.netPay },
            ]}
          />
        </div>
      </section>
    );
  }

  const current = ytdBreakdown.currentEmployer;
  const combined = ytdBreakdown.combined;
  const prior = ytdBreakdown.prior;

  return (
    <section className="space-y-1.5 border-b border-border/70 px-3 py-2 sm:px-4 print:space-y-0.5 print:px-2.5 print:py-0.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
          Prior employer · {ytdBreakdown.year}
          <span className="ml-1.5 font-normal normal-case tracking-normal">
            ({prior.recordCount} record{prior.recordCount === 1 ? "" : "s"})
          </span>
        </p>
        <YtdMetricStrip
          currency={currency}
          metrics={[
            { label: "Taxable", amount: prior.taxableIncome },
            { label: "PAYE", amount: prior.paye },
            { label: "NIS", amount: prior.nisEmployee },
            { label: "Health", amount: prior.healthSurcharge },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
          This employer · {ytdBreakdown.year}
          <span className="ml-1.5 font-normal normal-case tracking-normal">
            (
            {current.periodCount}{" "}
            {current.periodCount === 1 ? "period" : "periods"})
          </span>
        </p>
        <YtdMetricStrip
          currency={currency}
          metrics={[
            { label: "Gross", amount: current.grossPay },
            { label: "Deductions", amount: current.totalDeductions },
            { label: "PAYE", amount: current.paye },
            { label: "NIS", amount: current.nisEmployee },
            { label: "Health", amount: current.healthSurcharge },
            { label: "Net", amount: current.netPay },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
          Combined · {ytdBreakdown.year}
        </p>
        <YtdMetricStrip
          currency={currency}
          metrics={[
            { label: "Taxable", amount: combined.taxableEarnings },
            { label: "PAYE", amount: combined.paye },
            { label: "NIS", amount: combined.nisEmployee },
            { label: "Health", amount: combined.healthSurcharge },
            { label: "Gross", amount: combined.grossPay },
            { label: "Net", amount: combined.netPay },
          ]}
        />
      </div>
    </section>
  );
}

function isBankDeduction(line: PayslipLineItem): boolean {
  return line.label.startsWith("Bank transfer");
}

function LineRows({
  lines,
  currency,
  compact = false,
}: {
  lines: PayslipLineItem[];
  currency: string;
  compact?: boolean;
}) {
  const cellPad = compact
    ? "px-3 py-1 print:px-2.5 print:py-px"
    : "px-3 py-1.5 print:px-2.5 print:py-px";

  return (
    <>
      {lines.map((line, index) => (
        <tr
          key={`${line.label}-${line.amount}-${index}`}
          className="border-b border-border/40 last:border-0"
        >
          <td className={`${cellPad} align-top`}>
            <p className="text-sm font-medium leading-snug text-foreground print:text-[10px]">
              {line.label}
            </p>
            {line.detail ? (
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground print:mt-0 print:text-[8px]">
                {line.detail}
              </p>
            ) : null}
          </td>
          <td
            className={`${cellPad} text-right align-top text-sm print:text-[10px]`}
          >
            <Amount amount={line.amount} currency={currency} />
          </td>
        </tr>
      ))}
    </>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[9px]">
      {children}
    </h2>
  );
}

function CompactLinesTable({
  lines,
  currency,
  emptyLabel,
}: {
  lines: PayslipLineItem[];
  currency: string;
  emptyLabel: string;
}) {
  if (lines.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <table className="w-full text-sm">
      <tbody>
        <LineRows lines={lines} currency={currency} compact />
      </tbody>
    </table>
  );
}

function MetaItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground print:text-[8px]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium leading-tight text-foreground tabular-nums print:mt-0 print:text-[10px]">
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground print:mt-0 print:text-[9px]">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function ProjectedTaxYearSection({
  currency,
  projected,
}: {
  currency: string;
  projected: ProjectedTaxYearPosition;
}) {
  const hasPrior = projected.previousEmployerTaxableIncome > 0;
  const combinedAllowance =
    projected.personalAllowance + projected.allowableQualifyingDeduction;

  return (
    <section className="space-y-1.5 border-b border-border/70 px-3 py-2 sm:px-4 print:space-y-0.5 print:px-2.5 print:py-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
        Annual PAYE projection · {projected.taxYear}
        <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/80">
          (v{projected.version} · {projected.payFrequency.toLowerCase()} ·
          estimate — not paid)
        </span>
      </p>

      {hasPrior ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
            Previous employer (actual)
          </p>
          <YtdMetricStrip
            currency={currency}
            metrics={[
              {
                label: "Taxable",
                amount: projected.previousEmployerTaxableIncome,
              },
              { label: "PAYE", amount: projected.previousEmployerPaye },
            ]}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
          Current employer YTD (actual)
        </p>
        <YtdMetricStrip
          currency={currency}
          metrics={[
            {
              label: "Taxable",
              amount: projected.currentEmployerActualTaxableIncome,
            },
            { label: "PAYE", amount: projected.currentEmployerPaye },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
          Projected remaining
          <span className="ml-1.5 font-normal normal-case tracking-normal">
            ({projected.remainingPayrollPeriods} period
            {projected.remainingPayrollPeriods === 1 ? "" : "s"} · not paid)
          </span>
        </p>
        <YtdMetricStrip
          currency={currency}
          metrics={[
            {
              label: "Taxable",
              amount: projected.projectedRemainingTaxableIncome,
            },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
          Tax calculation
        </p>
        <YtdMetricStrip
          currency={currency}
          metrics={[
            {
              label: "Proj. taxable",
              amount: projected.projectedAnnualTaxableIncome,
            },
            {
              label: "Personal allowance",
              amount: projected.personalAllowance,
            },
            {
              label: "Qualifying",
              amount: projected.allowableQualifyingDeduction,
            },
            {
              label: "Combined allowance",
              amount: combinedAllowance,
            },
            {
              label: "Chargeable",
              amount: projected.projectedChargeableIncome,
            },
            {
              label: "Annual tax",
              amount: projected.projectedAnnualTaxLiability,
            },
            ...(projected.manualTaxAdjustment !== 0
              ? [
                  {
                    label: "Manual adj.",
                    amount: projected.manualTaxAdjustment,
                  },
                ]
              : []),
            {
              label: "Remaining tax",
              amount: projected.remainingTaxLiability,
            },
            ...(projected.recommendedPayePerPeriod != null
              ? [
                  {
                    label: `PAYE / period (${projected.remainingPayrollPeriods})`,
                    amount: projected.recommendedPayePerPeriod,
                  },
                ]
              : []),
          ]}
        />
      </div>
    </section>
  );
}

export function PayslipDocument({
  payslip,
  meta,
  ytd = null,
  ytdBreakdown = null,
  projectedTaxYearPosition = null,
  showWarnings = true,
  isOfficial = false,
}: {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  /** Year-to-date totals (prior posted + this slip/preview). */
  ytd?: PayslipYtdTotals | null;
  /** Phase 9: prior / this-employer / combined split when prior exists. */
  ytdBreakdown?: PayslipYtdBreakdown | null;
  /** Approved annual PAYE projection summary (estimate, not paid). */
  projectedTaxYearPosition?: ProjectedTaxYearPosition | null;
  /** When false, suppresses the preview warnings block (e.g. on the main preview page). */
  showWarnings?: boolean;
  /** Posted payslip — hide preview banner and show official footer. */
  isOfficial?: boolean;
}) {
  const { currency } = payslip;
  const position = meta.jobTitle?.trim() || "—";
  const primaryBank = payslip.bankDistribution?.find(
    (line) => line.kind === "REMAINDER",
  );
  const footerNotes = notesForPayslipDisplay(payslip.notes, isOfficial);

  const statutory = payslip.deductions.filter((line) => !isBankDeduction(line));
  const bank = payslip.deductions.filter(isBankDeduction);
  const hasBothDeductionGroups = statutory.length > 0 && bank.length > 0;
  const singleDeductionGroup =
    !hasBothDeductionGroups && payslip.deductions.length > 0
      ? bank.length > 0
        ? ({ title: "Bank transfers", lines: bank } as const)
        : ({ title: "Statutory / tax", lines: statutory } as const)
      : null;

  return (
    <>
      {showWarnings && !isOfficial && payslip.warnings.length > 0 ? (
        <section
          role="status"
          className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 print:mb-0 print:rounded-none print:border-border print:bg-transparent"
        >
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400 print:text-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Preview warnings
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {payslip.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <article className="overflow-hidden rounded-xl border border-border/80 bg-background print:rounded-none print:border print:border-border">
        {/* Org / period chrome + employee header */}
        <header className="border-b border-border/70 bg-muted/25 px-4 py-3 sm:px-5 print:bg-transparent print:px-2.5 print:py-1.5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 print:gap-y-0.5">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground print:text-[8px]">
                Employer
              </p>
              <p className="mt-0.5 text-base font-semibold tracking-tight text-foreground sm:text-lg print:mt-0 print:text-xs">
                {meta.organizationName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary print:text-[8px]">
                Payslip
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground sm:text-base print:mt-0 print:text-xs">
                {payslip.period.label}
              </p>
              <p className="text-[11px] text-muted-foreground print:text-[9px]">
                Currency {currency}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 border-t border-border/60 pt-3 sm:grid-cols-2 lg:grid-cols-4 print:mt-1 print:gap-1 print:pt-1 print:grid-cols-4">
            <MetaItem label="Employee" value={payslip.employee.displayName} />
            <MetaItem label="Position" value={position} />
            <MetaItem
              label="NIS no."
              value={payslip.employee.nisNumber ?? "—"}
            />
            <MetaItem
              label="BIR no."
              value={payslip.employee.birNumber ?? "—"}
            />
            {payslip.earnings.length === 0 ? (
              <MetaItem label="Earnings" value="None on file" />
            ) : (
              payslip.earnings.map((line, index) => (
                <MetaItem
                  key={`${line.label}-${line.amount}-${index}`}
                  label={line.label}
                  value={formatMoney(line.amount, { currency })}
                  detail={line.detail}
                />
              ))
            )}
            <MetaItem
              label="Gross pay"
              value={formatMoney(payslip.grossPay, { currency })}
            />
            <MetaItem
              label="Taxable"
              value={formatMoney(payslip.monthlyTaxableEarnings, {
                currency,
              })}
            />
          </div>
        </header>

        {/* Deductions — two compact columns when both groups exist */}
        <section className="border-b border-border/70">
          <div className="border-b border-border/60 px-3 py-1.5 sm:px-4 print:px-2.5 print:py-0.5">
            <SectionTitle>Deductions</SectionTitle>
          </div>

          {payslip.deductions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground sm:px-4 print:px-2.5 print:py-0.5">
              No employee deductions calculated.
            </p>
          ) : hasBothDeductionGroups ? (
            <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border/70 print:grid-cols-2 print:divide-x print:divide-border/70">
              <div className="border-b border-border/60 sm:border-b-0 print:border-b-0">
                <p className="bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:bg-transparent print:px-2.5 print:py-0.5 sm:px-4">
                  Statutory / tax
                </p>
                <CompactLinesTable
                  lines={statutory}
                  currency={currency}
                  emptyLabel="None"
                />
              </div>
              <div>
                <p className="bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:bg-transparent print:px-2.5 print:py-0.5 sm:px-4">
                  Bank transfers
                </p>
                <CompactLinesTable
                  lines={bank}
                  currency={currency}
                  emptyLabel="None"
                />
              </div>
            </div>
          ) : singleDeductionGroup ? (
            <div>
              <p className="bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:bg-transparent print:px-2.5 print:py-0.5 sm:px-4">
                {singleDeductionGroup.title}
              </p>
              <CompactLinesTable
                lines={singleDeductionGroup.lines}
                currency={currency}
                emptyLabel="None"
              />
            </div>
          ) : null}

          {/* Totals + net — full width under both deduction columns */}
          <div className="border-t border-border/70">
            <div className="flex items-baseline justify-between gap-3 bg-muted/20 px-3 py-1.5 print:bg-transparent print:px-2.5 print:py-0.5 sm:px-4">
              <p className="text-sm font-semibold text-foreground print:text-[10px]">
                Total deductions
              </p>
              <Amount
                amount={payslip.totalDeductions}
                currency={currency}
                showCurrency
                className="text-sm font-semibold text-foreground print:text-[10px]"
              />
            </div>

            <div className="border-t border-primary/20 bg-primary/5 px-3 py-2.5 print:border-border print:bg-transparent print:px-2.5 print:py-1 sm:px-4">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5 print:gap-y-0">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary print:text-[8px]">
                    Net pay
                  </p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl print:mt-0 print:text-base">
                    {formatMoney(payslip.netPay, { currency })}
                  </p>
                  {primaryBank ? (
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm print:mt-0 print:text-[9px]">
                      Net pay paid to primary bank — {primaryBank.bankName}
                      <span className="ml-1.5 font-mono text-[11px] print:text-[9px]">
                        ({primaryBank.accountNumberMasked})
                      </span>
                    </p>
                  ) : null}
                </div>
                <p className="text-right text-[11px] leading-relaxed text-muted-foreground sm:text-xs print:text-[9px] print:leading-tight">
                  Gross{" "}
                  <Amount
                    amount={payslip.grossPay}
                    currency={currency}
                    showCurrency
                    className="font-medium text-foreground"
                  />
                  <span className="mx-1 text-muted-foreground/70">−</span>
                  deductions{" "}
                  <Amount
                    amount={payslip.totalDeductions}
                    currency={currency}
                    showCurrency
                    className="font-medium text-foreground"
                  />
                </p>
              </div>
            </div>
          </div>
        </section>

        {ytd ? (
          <YtdSection
            currency={currency}
            ytd={ytd}
            ytdBreakdown={ytdBreakdown}
          />
        ) : null}

        {projectedTaxYearPosition ? (
          <ProjectedTaxYearSection
            currency={currency}
            projected={projectedTaxYearPosition}
          />
        ) : null}

        {payslip.employerContributions.length > 0 ? (
          <section className="border-b border-border/70 px-3 py-2 sm:px-4 print:px-2.5 print:py-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
              Employer contributions
              <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/80">
                (informational — not deducted from net)
              </span>
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 print:mt-0 print:gap-x-3">
              {payslip.employerContributions.map((line) => (
                <li
                  key={line.label}
                  className="flex items-baseline gap-1.5 text-xs print:text-[9px]"
                >
                  <span className="text-muted-foreground">
                    {line.label}
                    {line.detail ? (
                      <span className="ml-1 text-[10px] print:text-[8px]">
                        ({line.detail.split(" · ")[0]})
                      </span>
                    ) : null}
                  </span>
                  <Amount
                    amount={line.amount}
                    currency={currency}
                    showCurrency
                    className="font-medium text-foreground"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="px-3 py-2.5 sm:px-4 print:px-2.5 print:py-1">
          <p className="text-[11px] font-medium text-muted-foreground print:text-[9px] print:leading-tight">
            {isOfficial
              ? "Official payslip — amounts frozen from a posted pay run."
              : "Preview — not an official payslip. Pay runs have not been posted."}
          </p>
          {footerNotes.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-muted-foreground/90 print:mt-0.5 print:space-y-0 print:text-[8px] print:leading-snug">
              {footerNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </footer>
      </article>
    </>
  );
}
