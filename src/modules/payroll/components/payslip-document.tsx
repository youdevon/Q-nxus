import { CircleAlert } from "lucide-react";

import { formatMoney } from "@/src/lib/format";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import type {
  PayslipLineItem,
  PayslipPreview,
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
}: {
  lines: PayslipLineItem[];
  currency: string;
}) {
  return (
    <>
      {lines.map((line, index) => (
        <tr
          key={`${line.label}-${line.amount}-${index}`}
          className="border-b border-border/40 last:border-0"
        >
          <td className="px-4 py-2.5 align-top">
            <p className="font-medium leading-snug text-foreground">
              {line.label}
            </p>
            {line.detail ? (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {line.detail}
              </p>
            ) : null}
          </td>
          <td className="px-4 py-2.5 text-right align-top">
            <Amount amount={line.amount} currency={currency} />
          </td>
        </tr>
      ))}
    </>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <tr className="bg-muted/20 print:bg-transparent">
      <td
        colSpan={2}
        className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </td>
    </tr>
  );
}

function EarningsTable({
  lines,
  currency,
  emptyLabel,
  totalLabel,
  totalAmount,
}: {
  lines: PayslipLineItem[];
  currency: string;
  emptyLabel: string;
  totalLabel: string;
  totalAmount: number;
}) {
  if (lines.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2.5 font-medium">Description</th>
          <th className="px-4 py-2.5 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        <LineRows lines={lines} currency={currency} />
      </tbody>
      <tfoot>
        <tr className="border-t border-border/70 bg-muted/30 print:bg-transparent">
          <td className="px-4 py-3 text-sm font-semibold">{totalLabel}</td>
          <td className="px-4 py-3 text-right text-sm font-semibold">
            <Amount amount={totalAmount} currency={currency} showCurrency />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function DeductionsTable({
  lines,
  currency,
  emptyLabel,
  totalAmount,
}: {
  lines: PayslipLineItem[];
  currency: string;
  emptyLabel: string;
  totalAmount: number;
}) {
  if (lines.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  const statutory = lines.filter((line) => !isBankDeduction(line));
  const bank = lines.filter(isBankDeduction);
  const showGroups = statutory.length > 0 && bank.length > 0;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2.5 font-medium">Description</th>
          <th className="px-4 py-2.5 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {showGroups ? (
          <>
            <GroupHeader label="Statutory / tax" />
            <LineRows lines={statutory} currency={currency} />
            <GroupHeader label="Bank transfers" />
            <LineRows lines={bank} currency={currency} />
          </>
        ) : (
          <LineRows lines={lines} currency={currency} />
        )}
      </tbody>
      <tfoot>
        <tr className="border-t border-border/70 bg-muted/30 print:bg-transparent">
          <td className="px-4 py-3 text-sm font-semibold">Total deductions</td>
          <td className="px-4 py-3 text-right text-sm font-semibold">
            <Amount amount={totalAmount} currency={currency} showCurrency />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">
        {value}
      </p>
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

  return (
    <>
      {showWarnings && !isOfficial && payslip.warnings.length > 0 ? (
        <section
          role="status"
          className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 print:mb-0 print:rounded-none print:border-border print:bg-transparent"
        >
          <div className="flex items-start gap-2.5">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400 print:text-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Preview warnings
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {payslip.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <article className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm print:rounded-none print:border print:border-border print:shadow-none">
        <header className="border-b border-border/70 bg-muted/25 px-5 py-5 sm:px-7 sm:py-6 print:bg-transparent">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Employer
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {meta.organizationName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Payslip
              </p>
              <p className="mt-1 text-base font-semibold text-foreground sm:text-lg">
                {payslip.period.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Currency {currency}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2 lg:grid-cols-4">
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
          </div>
        </header>

        <div className="grid md:grid-cols-2 md:divide-x md:divide-border/70">
          <section className="border-b border-border/70 md:border-b-0">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Earnings
              </h2>
            </div>
            <EarningsTable
              lines={payslip.earnings}
              currency={currency}
              emptyLabel="No earnings on file."
              totalLabel="Gross pay"
              totalAmount={payslip.grossPay}
            />
          </section>

          <section>
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Deductions
              </h2>
            </div>
            <DeductionsTable
              lines={payslip.deductions}
              currency={currency}
              emptyLabel="No employee deductions calculated."
              totalAmount={payslip.totalDeductions}
            />
          </section>
        </div>

        <section className="border-b border-border/70 bg-muted/15 px-5 py-4 sm:px-7 print:bg-transparent">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem
              label="Base salary"
              value={formatMoney(payslip.baseSalary, { currency })}
            />
            <MetaItem
              label="Allowances"
              value={formatMoney(payslip.allowancesTotal, { currency })}
            />
            <MetaItem
              label="Gross pay"
              value={formatMoney(payslip.grossPay, { currency })}
            />
            <MetaItem
              label="Taxable pay"
              value={formatMoney(payslip.monthlyTaxableEarnings, { currency })}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Phase 1 statutory deductions use base salary only. Allowances remain
            visible in earnings and gross pay.
          </p>
        </section>

        <section className="border-y border-primary/20 bg-primary/5 px-5 py-5 sm:px-7 print:border-border print:bg-transparent">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                Net pay
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
                {formatMoney(payslip.netPay, { currency })}
              </p>
              {primaryBank ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Net pay paid to primary bank — {primaryBank.bankName}
                  <span className="ml-1.5 font-mono text-xs">
                    ({primaryBank.accountNumberMasked})
                  </span>
                </p>
              ) : null}
            </div>
            <p className="max-w-xs text-right text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Gross{" "}
              <Amount
                amount={payslip.grossPay}
                currency={currency}
                showCurrency
                className="font-medium text-foreground"
              />
              <span className="mx-1.5 text-muted-foreground/70">−</span>
              deductions{" "}
              <Amount
                amount={payslip.totalDeductions}
                currency={currency}
                showCurrency
                className="font-medium text-foreground"
              />
            </p>
          </div>
        </section>

        {ytd && ytd.periodCount > 0 ? (
          <section className="border-b border-border/70 px-5 py-3 sm:px-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Year to date · {ytd.year}
                <span className="ml-1.5 font-normal normal-case tracking-normal">
                  ({ytd.periodCount} period{ytd.periodCount === 1 ? "" : "s"})
                </span>
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
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
          <section className="border-b border-border/70 bg-muted/15 px-5 py-4 sm:px-7 print:bg-transparent">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Employer contributions
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Informational only — not deducted from employee net pay.
            </p>
            <ul className="mt-3 space-y-1.5">
              {payslip.employerContributions.map((line) => (
                <li
                  key={line.label}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {line.label}
                    {line.detail ? (
                      <span className="ml-1.5 text-xs">
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

        <footer className="px-5 py-4 sm:px-7">
          <p className="text-xs font-medium text-muted-foreground">
            {isOfficial
              ? "Official payslip — amounts frozen from a posted pay run."
              : "Preview — not an official payslip. Pay runs have not been posted."}
          </p>
          {payslip.notes.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground/90">
              {payslip.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </footer>
      </article>
    </>
  );
}
