import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

import { formatMoney } from "@/src/lib/format";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import {
  notesForPayslipDisplay,
  type PayslipLineItem,
  type PayslipPreview,
} from "@/src/modules/payroll/lib/payslip-preview";
import type { PayslipYtdTotals } from "@/src/modules/payroll/lib/payslip-ytd";

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
  const cellPad = compact ? "px-3 py-1" : "px-3 py-1.5";

  return (
    <>
      {lines.map((line, index) => (
        <tr
          key={`${line.label}-${line.amount}-${index}`}
          className="border-b border-border/40 last:border-0"
        >
          <td className={`${cellPad} align-top`}>
            <p className="text-sm font-medium leading-snug text-foreground">
              {line.label}
            </p>
            {line.detail ? (
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {line.detail}
              </p>
            ) : null}
          </td>
          <td className={`${cellPad} text-right align-top text-sm`}>
            <Amount amount={line.amount} currency={currency} />
          </td>
        </tr>
      ))}
    </>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium leading-tight text-foreground tabular-nums">
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export function PayslipDocument({
  payslip,
  meta,
  ytd = null,
  showWarnings = true,
  isOfficial = false,
}: {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  /** Year-to-date totals (prior posted + this slip/preview). */
  ytd?: PayslipYtdTotals | null;
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

      <article className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm print:rounded-none print:border print:border-border print:shadow-none">
        {/* Org / period chrome + employee header */}
        <header className="border-b border-border/70 bg-muted/25 px-4 py-3 sm:px-5 print:bg-transparent">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Employer
              </p>
              <p className="mt-0.5 text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {meta.organizationName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                Payslip
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground sm:text-base">
                {payslip.period.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Currency {currency}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 border-t border-border/60 pt-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="border-b border-border/60 px-3 py-1.5 sm:px-4">
            <SectionTitle>Deductions</SectionTitle>
          </div>

          {payslip.deductions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground sm:px-4">
              No employee deductions calculated.
            </p>
          ) : hasBothDeductionGroups ? (
            <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border/70">
              <div className="border-b border-border/60 sm:border-b-0">
                <p className="bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:bg-transparent sm:px-4">
                  Statutory / tax
                </p>
                <CompactLinesTable
                  lines={statutory}
                  currency={currency}
                  emptyLabel="None"
                />
              </div>
              <div>
                <p className="bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:bg-transparent sm:px-4">
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
              <p className="bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:bg-transparent sm:px-4">
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
            <div className="flex items-baseline justify-between gap-3 bg-muted/20 px-3 py-1.5 print:bg-transparent sm:px-4">
              <p className="text-sm font-semibold text-foreground">
                Total deductions
              </p>
              <Amount
                amount={payslip.totalDeductions}
                currency={currency}
                showCurrency
                className="text-sm font-semibold text-foreground"
              />
            </div>

            <div className="border-t border-primary/20 bg-primary/5 px-3 py-2.5 print:border-border print:bg-transparent sm:px-4">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                    Net pay
                  </p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
                    {formatMoney(payslip.netPay, { currency })}
                  </p>
                  {primaryBank ? (
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      Net pay paid to primary bank — {primaryBank.bankName}
                      <span className="ml-1.5 font-mono text-[11px]">
                        ({primaryBank.accountNumberMasked})
                      </span>
                    </p>
                  ) : null}
                </div>
                <p className="text-right text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
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

        {ytd && ytd.periodCount > 0 ? (
          <section className="border-b border-border/70 px-3 py-2 sm:px-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Year to date · {ytd.year}
                <span className="ml-1.5 font-normal normal-case tracking-normal">
                  ({ytd.periodCount} period{ytd.periodCount === 1 ? "" : "s"})
                </span>
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
                <span>
                  Gross{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(ytd.grossPay, { currency })}
                  </span>
                </span>
                <span>
                  Deductions{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(ytd.totalDeductions, { currency })}
                  </span>
                </span>
                <span>
                  PAYE{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(ytd.paye, { currency })}
                  </span>
                </span>
                <span>
                  NIS{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(ytd.nisEmployee, { currency })}
                  </span>
                </span>
                <span>
                  Health{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(ytd.healthSurcharge, { currency })}
                  </span>
                </span>
                <span>
                  Net{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(ytd.netPay, { currency })}
                  </span>
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {payslip.employerContributions.length > 0 ? (
          <section className="border-b border-border/70 px-3 py-2 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Employer contributions
              <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/80">
                (informational — not deducted from net)
              </span>
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
              {payslip.employerContributions.map((line) => (
                <li
                  key={line.label}
                  className="flex items-baseline gap-1.5 text-xs"
                >
                  <span className="text-muted-foreground">
                    {line.label}
                    {line.detail ? (
                      <span className="ml-1 text-[10px]">
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

        <footer className="px-3 py-2.5 sm:px-4">
          <p className="text-[11px] font-medium text-muted-foreground">
            {isOfficial
              ? "Official payslip — amounts frozen from a posted pay run."
              : "Preview — not an official payslip. Pay runs have not been posted."}
          </p>
          {footerNotes.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-muted-foreground/90">
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
