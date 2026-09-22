import { cn } from "@/lib/utils";
import { formatMoney } from "@/src/lib/format";
import { UI_TYPOGRAPHY } from "@/src/config/ui-typography";
import { runKindLabel } from "@/src/modules/payroll/lib/payroll-analytics";
import type { PayrollRegisterDocument } from "@/src/modules/payroll/lib/payroll-register-document";

function money(amount: number, currency: string) {
  return formatMoney(amount, { currency });
}

const employerKpiClass =
  "rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2";
const employerKpiLabelClass =
  "text-[10px] font-medium uppercase tracking-wide text-sky-800 dark:text-sky-200/90";
const employerThClass =
  "border-l border-sky-500/25 bg-sky-500/15 px-3 py-2.5 text-right font-medium text-sky-900 dark:text-sky-100";
const employerTdClass =
  "border-l border-sky-500/20 bg-sky-500/8 px-3 py-2.5 text-right tabular-nums text-sky-950 dark:bg-sky-950/25 dark:text-sky-50";
const nisTotalThClass =
  "bg-sky-500/20 px-3 py-2.5 text-right font-semibold text-sky-900 dark:text-sky-100";
const nisTotalTdClass =
  "bg-sky-500/12 px-3 py-2.5 text-right tabular-nums font-medium text-sky-950 dark:bg-sky-950/35 dark:text-sky-50";

/**
 * On-screen paysheet register for the Posted payroll report —
 * same columns, totals, and document sizing as a pay-run paysheet.
 */
export function PostedPayrollRegisterDocument({
  register,
  periodLabel,
}: {
  register: PayrollRegisterDocument;
  periodLabel: string;
}) {
  const { currency, totals, rows, mode } = register;
  const showSlipMeta = mode === "slip";

  const summaryItems = [
    { label: "Gross", value: money(totals.grossPay, currency), employer: false },
    { label: "PAYE", value: money(totals.paye, currency), employer: false },
    {
      label: "NIS (ee)",
      value: money(totals.nisEmployee, currency),
      employer: false,
    },
    {
      label: "Health",
      value: money(totals.healthSurcharge, currency),
      employer: false,
    },
    {
      label: "Other deductions",
      value: money(totals.otherDeductions, currency),
      employer: false,
    },
    {
      label: "Total deductions",
      value: money(totals.totalDeductions, currency),
      employer: false,
    },
    { label: "Net pay", value: money(totals.netPay, currency), employer: false },
    {
      label: "NIS (er)",
      value: money(totals.nisEmployer, currency),
      employer: true,
    },
    {
      label: "NIS payment",
      value: money(totals.nisPayment, currency),
      employer: true,
    },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Payroll register
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodLabel} · {register.employeeCount} employee
            {register.employeeCount === 1 ? "" : "s"} · {register.payslipCount}{" "}
            payslip{register.payslipCount === 1 ? "" : "s"}
            {mode === "employee"
              ? " · amounts auto-calculated for the period"
              : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-md border border-border/70 bg-muted/20 px-3 py-2",
              item.employer && employerKpiClass,
            )}
          >
            <p
              className={cn(
                "text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                item.employer && employerKpiLabelClass,
              )}
            >
              {item.label}
            </p>
            <p
              className={`mt-1 ${UI_TYPOGRAPHY.moneyValue} ${
                item.label === "Net pay" ? UI_TYPOGRAPHY.moneyHero : ""
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border border-border/70">
        <table className="w-full min-w-[72rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {showSlipMeta ? (
                <>
                  <th className="px-3 py-2.5 font-medium">Period</th>
                  <th className="px-3 py-2.5 font-medium">Run</th>
                </>
              ) : null}
              <th className="px-3 py-2.5 font-medium">Emp #</th>
              <th className="px-3 py-2.5 font-medium">Employee</th>
              <th className="px-3 py-2.5 font-medium">Department</th>
              <th className="px-3 py-2.5 text-right font-medium">Basic</th>
              <th className="px-3 py-2.5 text-right font-medium">Allowances</th>
              <th className="px-3 py-2.5 text-right font-medium">Gross</th>
              <th className="px-3 py-2.5 text-right font-medium">PAYE</th>
              <th className="px-3 py-2.5 text-right font-medium">NIS (ee)</th>
              <th className="px-3 py-2.5 text-right font-medium">Health</th>
              <th className="px-3 py-2.5 text-right font-medium">Other</th>
              <th className="px-3 py-2.5 text-right font-medium">Deductions</th>
              <th className="px-3 py-2.5 text-right font-medium">Net</th>
              <th className={employerThClass}>NIS (er)</th>
              <th className={nisTotalThClass}>NIS payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className="border-b border-border/60 align-top"
              >
                {showSlipMeta ? (
                  <>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {row.periodName ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{row.runNumber ?? "—"}</div>
                      {row.runKind && row.runKind !== "REGULAR" ? (
                        <div className="text-xs text-muted-foreground">
                          {runKindLabel(row.runKind)}
                        </div>
                      ) : null}
                    </td>
                  </>
                ) : null}
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  {row.employeeNumber}
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{row.employeeName}</div>
                  {row.jobTitle ? (
                    <div className="text-xs text-muted-foreground">
                      {row.jobTitle}
                    </div>
                  ) : null}
                  {!showSlipMeta && row.payslipCount > 1 ? (
                    <div className="text-xs text-muted-foreground">
                      {row.payslipCount} payslips
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {row.departmentName ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(row.baseSalary, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(row.allowancesTotal, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(row.grossPay, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(row.paye, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(row.nisEmployee, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(row.healthSurcharge, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(row.otherDeductions, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(row.totalDeductions, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                  {money(row.netPay, currency)}
                </td>
                <td className={employerTdClass}>
                  {money(row.nisEmployer, currency)}
                </td>
                <td className={nisTotalTdClass}>
                  {money(row.nisPayment, currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 font-semibold">
              <td
                className="px-3 py-2.5"
                colSpan={showSlipMeta ? 5 : 3}
              >
                Total
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(totals.baseSalary, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(totals.allowancesTotal, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(totals.grossPay, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(totals.paye, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(totals.nisEmployee, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(totals.healthSurcharge, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(totals.otherDeductions, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(totals.totalDeductions, currency)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(totals.netPay, currency)}
              </td>
              <td className={cn(employerTdClass, "font-semibold")}>
                {money(totals.nisEmployer, currency)}
              </td>
              <td className={cn(nisTotalTdClass, "font-semibold")}>
                {money(totals.nisPayment, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
