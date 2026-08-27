import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

import { formatMoney } from "@/src/lib/format";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { sumMoney } from "@/src/modules/payroll/lib/money";
import {
  findPayslipMetaAllowanceAmount,
  isPayslipMetaAllowanceLine,
  payslipLineDetailForDisplay,
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

function isBankDeduction(line: PayslipLineItem): boolean {
  return line.label.startsWith("Bank transfer");
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
  const showPrior =
    ytdBreakdown != null && ytdBreakdown.prior.recordCount > 0;

  const metrics = showPrior && ytdBreakdown
    ? [
        { label: "Gross", amount: ytdBreakdown.combined.grossPay },
        { label: "NIS", amount: ytdBreakdown.combined.nisEmployee },
        {
          label: "Health Surcharge",
          amount: ytdBreakdown.combined.healthSurcharge,
        },
        { label: "PAYE", amount: ytdBreakdown.combined.paye },
      ]
    : [
        { label: "Gross", amount: ytd.grossPay },
        { label: "NIS", amount: ytd.nisEmployee },
        { label: "Health Surcharge", amount: ytd.healthSurcharge },
        { label: "PAYE", amount: ytd.paye },
      ];

  const periodLabel =
    ytd.periodCount > 0
      ? `(${ytd.periodCount} period${ytd.periodCount === 1 ? "" : "s"})`
      : "(this slip)";

  return (
    <section className="border-b border-border/70 px-3 py-2 sm:px-4 print:px-2.5 print:py-0.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 print:gap-y-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-[8px]">
          Year to date · {ytd.year}
          {showPrior ? (
            <span className="ml-1.5 font-normal normal-case tracking-normal">
              (includes prior employer)
            </span>
          ) : (
            <span className="ml-1.5 font-normal normal-case tracking-normal">
              {periodLabel}
            </span>
          )}
        </p>
        <YtdMetricStrip currency={currency} metrics={metrics} />
      </div>
    </section>
  );
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
      {lines.map((line, index) => {
        const detail = payslipLineDetailForDisplay(line.detail);
        return (
        <tr
          key={`${line.label}-${line.amount}-${index}`}
          className="border-b border-border/40 last:border-0"
        >
          <td className="px-3 py-1.5 align-top print:px-2.5 print:py-px sm:px-4">
            <p className="text-sm font-medium leading-snug text-foreground print:text-[10px]">
              {line.label}
            </p>
            {detail ? (
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground print:mt-0 print:text-[8px]">
                {detail}
              </p>
            ) : null}
          </td>
          <td className="px-3 py-1.5 text-right align-top text-sm print:px-2.5 print:py-px print:text-[10px] sm:px-4">
            <Amount amount={line.amount} currency={currency} />
          </td>
        </tr>
        );
      })}
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

function LinesTable({
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
      <p className="px-3 py-2 text-xs text-muted-foreground sm:px-4 print:px-2.5 print:py-0.5">
        {emptyLabel}
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <tbody>
        <LineRows lines={lines} currency={currency} />
      </tbody>
    </table>
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground print:text-[8px]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium leading-tight text-foreground tabular-nums print:mt-0 print:text-[10px]">
        {value}
      </p>
    </div>
  );
}

function TotalRow({
  label,
  amount,
  currency,
  emphasize = false,
}: {
  label: string;
  amount: number;
  currency: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={
        emphasize
          ? "flex items-baseline justify-between gap-3 border-t border-border/70 bg-muted/20 px-3 py-1.5 print:bg-transparent print:px-2.5 print:py-0.5 sm:px-4"
          : "flex items-baseline justify-between gap-3 border-t border-border/60 px-3 py-1.5 print:px-2.5 print:py-0.5 sm:px-4"
      }
    >
      <p
        className={
          emphasize
            ? "text-sm font-semibold text-foreground print:text-[10px]"
            : "text-sm text-foreground print:text-[10px]"
        }
      >
        {label}
      </p>
      <Amount
        amount={amount}
        currency={currency}
        showCurrency
        className={
          emphasize
            ? "text-sm font-semibold text-foreground print:text-[10px]"
            : "text-sm font-medium text-foreground print:text-[10px]"
        }
      />
    </div>
  );
}

/**
 * Official / preview payslip surface shared by screen, print, and batch print.
 * Annual PAYE projection stays on its dedicated tax-year views — not here.
 */
export function PayslipDocument({
  payslip,
  meta,
  ytd = null,
  ytdBreakdown = null,
  projectedTaxYearPosition: _projectedTaxYearPosition = null,
  showWarnings = true,
  isOfficial = false,
}: {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  /** Year-to-date totals (prior posted + this slip/preview). */
  ytd?: PayslipYtdTotals | null;
  /** Prior / this-employer / combined split when prior exists — shown as one YTD strip. */
  ytdBreakdown?: PayslipYtdBreakdown | null;
  /**
   * Kept for call-site compatibility. Not rendered on the payslip —
   * use the annual PAYE projection worksheet instead.
   */
  projectedTaxYearPosition?: ProjectedTaxYearPosition | null;
  /** When false, suppresses the preview warnings block (e.g. on the main preview page). */
  showWarnings?: boolean;
  /** Posted payslip — hide preview banner and show official footer. */
  isOfficial?: boolean;
}) {
  const { currency } = payslip;
  const position = meta.jobTitle?.trim() || "—";

  const employeeDeductions = payslip.deductions.filter(
    (line) => !isBankDeduction(line),
  );
  const employeeDeductionTotal = sumMoney(
    ...employeeDeductions.map((line) => line.amount),
  );
  const salaryAmount =
    findPayslipMetaAllowanceAmount(payslip.earnings, "salary") ??
    (payslip.baseSalary > 0 ? payslip.baseSalary : undefined);
  const travellingAmount = findPayslipMetaAllowanceAmount(
    payslip.earnings,
    "travel",
  );
  const phoneAmount = findPayslipMetaAllowanceAmount(payslip.earnings, "phone");
  const earningsAboveGross = payslip.earnings.filter(
    (line) => !isPayslipMetaAllowanceLine(line),
  );

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
                {payslip.period.payFrequency} · {currency}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3 print:mt-1 print:space-y-1 print:pt-1">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 print:grid-cols-4 print:gap-1">
              <MetaItem label="Employee" value={payslip.employee.displayName} />
              <MetaItem label="Position" value={position} />
              <MetaItem
                label="NIS NO."
                value={payslip.employee.nisNumber ?? "—"}
              />
              <MetaItem
                label="BIR NO."
                value={payslip.employee.birNumber ?? "—"}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 print:grid-cols-4 print:gap-1">
              <MetaItem
                label="Salary"
                value={
                  salaryAmount != null ? formatMoney(salaryAmount) : "—"
                }
              />
              <MetaItem
                label="Travelling"
                value={
                  travellingAmount != null
                    ? formatMoney(travellingAmount)
                    : "—"
                }
              />
              <MetaItem
                label="Phone"
                value={phoneAmount != null ? formatMoney(phoneAmount) : "—"}
              />
              <MetaItem
                label="Taxable earnings"
                value={formatMoney(payslip.monthlyTaxableEarnings)}
              />
            </div>
          </div>
        </header>

        <section className="border-b border-border/70">
          {earningsAboveGross.length > 0 ? (
            <LinesTable
              lines={earningsAboveGross}
              currency={currency}
              emptyLabel=""
            />
          ) : null}
          <TotalRow
            label="Gross pay"
            amount={payslip.grossPay}
            currency={currency}
            emphasize
          />
        </section>

        <section className="border-b border-border/70">
          <div className="border-b border-border/60 px-3 py-1.5 sm:px-4 print:px-2.5 print:py-0.5">
            <SectionTitle>Deductions</SectionTitle>
          </div>
          <LinesTable
            lines={employeeDeductions}
            currency={currency}
            emptyLabel="No employee deductions calculated."
          />
          <TotalRow
            label="Total deductions"
            amount={employeeDeductionTotal}
            currency={currency}
            emphasize
          />
        </section>

        <section className="border-b border-border/70">
          <div className="border-t border-primary/20 bg-primary/5 px-3 py-2.5 print:border-border print:bg-transparent print:px-2.5 print:py-1 sm:px-4">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5 print:gap-y-0">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary print:text-[8px]">
                  Net pay
                </p>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl print:mt-0 print:text-base">
                  {formatMoney(payslip.netPay, { currency })}
                </p>
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
        </section>

        {ytd ? (
          <YtdSection
            currency={currency}
            ytd={ytd}
            ytdBreakdown={ytdBreakdown}
          />
        ) : null}
      </article>
    </>
  );
}
