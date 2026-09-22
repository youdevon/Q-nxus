import { formatMoney } from "@/src/lib/format";
import type { AnnualPayeProjectionResult } from "@/src/modules/payroll/lib/annual-paye-projection";

export type AnnualPayeProjectionPrintEmployee = {
  displayName: string;
  employeeNumber: string;
  departmentName: string | null;
  positionTitle: string | null;
  hireDate: string | null;
};

export type AnnualPayeProjectionPrintContext = {
  taxYear: number;
  currency: string;
  payFrequency: string;
  monthlyBasicSalary: number | null;
  contractEndDate: string | null;
  payeConfigVersionLabel: string | null;
  printedAt: string;
};

function money(value: number, currency: string): string {
  return formatMoney(value, { currency });
}

function PrintTable({
  title,
  columns,
  rows,
  footer,
}: {
  title: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Array<Record<string, string>>;
  footer?: Record<string, string>;
}) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
        {title}
      </h2>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b-2 border-neutral-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-2 py-1.5 font-semibold text-neutral-800 ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-neutral-300">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-1.5 tabular-nums text-neutral-900 ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          {footer ? (
            <tr className="border-t-2 border-neutral-800 font-semibold">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-1.5 tabular-nums ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {footer[col.key] ?? ""}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

export function AnnualPayeProjectionPrintDocument({
  employee,
  context,
  projection,
  isMidYearJoiner = false,
}: {
  employee: AnnualPayeProjectionPrintEmployee;
  context: AnnualPayeProjectionPrintContext;
  projection: AnnualPayeProjectionResult;
  isMidYearJoiner?: boolean;
}) {
  const { currency, taxYear } = context;
  const combinedAllowance =
    projection.personalAllowance +
    projection.qualifying.allowableQualifyingDeduction;

  return (
    <article className="annual-paye-projection-sheet bg-white text-neutral-900">
      <header className="border-b-2 border-neutral-800 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Q-NXUS Payroll
            </p>
            <h1 className="mt-1 text-lg font-bold tracking-tight">
              Employee Annual PAYE Projection
            </h1>
            <p className="mt-0.5 text-sm text-neutral-600">
              Tax year {taxYear}
              {isMidYearJoiner ? " · Mid-year joiner method" : null}
            </p>
          </div>
          <div className="text-right text-[10px] text-neutral-600">
            <p>Printed {context.printedAt}</p>
            {context.payeConfigVersionLabel ? (
              <p className="mt-0.5">Schedule: {context.payeConfigVersionLabel}</p>
            ) : null}
          </div>
        </div>
      </header>

      <PrintTable
        title="Employee"
        columns={[
          { key: "label", label: "Field" },
          { key: "value", label: "Detail" },
        ]}
        rows={[
          { label: "Name", value: employee.displayName },
          { label: "Employee number", value: employee.employeeNumber },
          {
            label: "Department",
            value: employee.departmentName ?? "—",
          },
          {
            label: "Position",
            value: employee.positionTitle ?? "—",
          },
          { label: "Hire date", value: employee.hireDate ?? "—" },
          { label: "Pay frequency", value: context.payFrequency },
          {
            label: "Monthly basic salary",
            value:
              context.monthlyBasicSalary != null
                ? money(context.monthlyBasicSalary, currency)
                : "—",
          },
          {
            label: "Contract end",
            value: context.contractEndDate ?? "—",
          },
          {
            label: "Projection as of",
            value: projection.periods.asOfDate,
          },
          {
            label: "Projection end",
            value: projection.periods.projectionEndDate,
          },
        ]}
      />

      <PrintTable
        title="1. Earnings by source"
        columns={[
          { key: "source", label: "Source" },
          { key: "taxable", label: "Taxable", align: "right" },
          { key: "paye", label: "PAYE", align: "right" },
          { key: "nis", label: "Employee NIS", align: "right" },
        ]}
        rows={[
          {
            source: "Previous employer (actual)",
            taxable: money(
              projection.previousEmployer.taxableEarnings,
              currency,
            ),
            paye: money(projection.previousEmployerPaye, currency),
            nis: money(projection.previousEmployer.employeeNis, currency),
          },
          {
            source: "Current employer YTD (actual)",
            taxable: money(
              projection.currentEmployerActual.taxableEarnings,
              currency,
            ),
            paye: money(projection.currentEmployerPaye, currency),
            nis: money(projection.currentEmployerActual.employeeNis, currency),
          },
          {
            source: `Projected remaining (${projection.periods.remainingPeriods} periods · not paid)`,
            taxable: money(
              projection.projectedRemaining.taxableEarnings,
              currency,
            ),
            paye: "—",
            nis: money(projection.projectedRemaining.employeeNis, currency),
          },
        ]}
        footer={{
          source: "Projected calendar-year total",
          taxable: money(projection.projectedAnnual.taxableEarnings, currency),
          paye: "—",
          nis: money(projection.projectedAnnual.employeeNis, currency),
        }}
      />

      <PrintTable
        title="2. Tax calculation"
        columns={[
          { key: "step", label: "Step" },
          { key: "amount", label: "Amount", align: "right" },
        ]}
        rows={[
          {
            step: "Projected annual taxable earnings",
            amount: money(
              projection.projectedAnnual.taxableEarnings,
              currency,
            ),
          },
          {
            step: "Less personal allowance",
            amount: `(${money(projection.personalAllowance, currency)})`,
          },
          {
            step: projection.qualifying.capped
              ? "Less qualifying deductions (capped)"
              : "Less qualifying deductions",
            amount: `(${money(
              projection.qualifying.allowableQualifyingDeduction,
              currency,
            )})`,
          },
          {
            step: "Combined allowance (personal + qualifying)",
            amount: money(combinedAllowance, currency),
          },
          {
            step: "Projected chargeable income",
            amount: money(projection.projectedChargeableIncome, currency),
          },
          ...projection.taxByBand.map((band) => ({
            step: `Tax at ${band.ratePercent}%`,
            amount: money(band.taxAmount, currency),
          })),
          {
            step: "Projected annual tax liability",
            amount: money(projection.projectedAnnualTaxLiability, currency),
          },
          {
            step: "Less previous-employer PAYE",
            amount: `(${money(projection.previousEmployerPaye, currency)})`,
          },
          {
            step: "Less current-employer PAYE",
            amount: `(${money(projection.currentEmployerPaye, currency)})`,
          },
          ...(projection.manualTaxAdjustment !== 0
            ? [
                {
                  step: "Manual tax adjustment",
                  amount: money(projection.manualTaxAdjustment, currency),
                },
              ]
            : []),
        ]}
        footer={{
          step: "Remaining projected PAYE liability",
          amount: money(projection.remainingTaxLiability, currency),
        }}
      />

      <PrintTable
        title="3. Recommended withholding"
        columns={[
          { key: "item", label: "Item" },
          { key: "value", label: "Value", align: "right" },
        ]}
        rows={[
          {
            item: "Remaining payroll periods",
            value: String(projection.periods.remainingPeriods),
          },
          {
            item: "Pay frequency",
            value: projection.periods.payFrequency,
          },
          {
            item: "Recommended PAYE per remaining period",
            value:
              projection.recommendedPayePerPeriod != null
                ? money(projection.recommendedPayePerPeriod, currency)
                : "—",
          },
        ]}
      />

      {projection.warnings.length > 0 ? (
        <section className="mt-5 break-inside-avoid">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
            Notes / warnings
          </h2>
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-neutral-700">
            {projection.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-neutral-300 pt-3 text-[10px] leading-relaxed text-neutral-500">
        <p>
          This is a planning worksheet, not an official payslip or BIR return.
          Projected remaining earnings are estimates and are not treated as
          salary already paid. Apply an approved projection (or statutory
          override) before payroll withholds the recommended PAYE amount.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <p className="border-b border-neutral-400 pb-8">Prepared by</p>
          </div>
          <div>
            <p className="border-b border-neutral-400 pb-8">Reviewed / approved</p>
          </div>
        </div>
      </footer>
    </article>
  );
}
