import { cn } from "@/lib/utils";
import { formatMoney } from "@/src/lib/format";
import type { PayRunPaysheetData } from "@/src/modules/payroll/data/get-pay-run-paysheet";
import {
  ReportPrintEmptyState,
  ReportPrintMuted,
  ReportPrintSection,
  ReportPrintSummaryGrid,
  ReportPrintTable,
  ReportPrintTableCell,
  ReportPrintTableRow,
} from "@/src/modules/reports/components/report-print-table";

function money(amount: number, currency: string) {
  return formatMoney(amount, { currency });
}

const employerCellClass =
  "border-l border-sky-300 bg-sky-50 text-sky-950 print:border-neutral-400 print:bg-neutral-100 print:text-neutral-900";
const nisTotalCellClass =
  "bg-sky-100 font-medium text-sky-950 print:bg-neutral-200 print:text-neutral-900";

export function PayRunPaysheetPrintContent({
  data,
}: {
  data: PayRunPaysheetData;
}) {
  const { currency, totals } = data;

  if (data.rows.length === 0) {
    return (
      <ReportPrintEmptyState
        message="No included employees on this paysheet yet. Calculate the run first."
      />
    );
  }

  return (
    <div className="space-y-6">
      {data.isPreview ? (
        <p className="rounded-md border border-amber-600/40 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 print:border-neutral-400 print:bg-transparent">
          Preview payroll register — status {data.statusLabel}. Figures may
          change until the paysheet is posted.
        </p>
      ) : null}

      <ReportPrintSummaryGrid
        items={[
          { label: "Employees", value: String(data.includedCount) },
          { label: "Gross", value: money(totals.grossPay, currency) },
          { label: "PAYE", value: money(totals.paye, currency) },
          { label: "NIS (ee)", value: money(totals.nisEmployee, currency) },
          { label: "Health", value: money(totals.healthSurcharge, currency) },
          {
            label: "Total deductions",
            value: money(totals.totalDeductions, currency),
          },
          { label: "Net pay", value: money(totals.netPay, currency) },
          { label: "NIS (er)", value: money(totals.nisEmployer, currency) },
          { label: "NIS payment", value: money(totals.nisPayment, currency) },
        ]}
      />

      <ReportPrintSection title="Payroll register">
        <ReportPrintTable
          headers={[
            "Emp #",
            "Employee",
            "Department",
            "Basic",
            "Allowances",
            "Gross",
            "PAYE",
            "NIS (ee)",
            "Health",
            "Other",
            "Deductions",
            "Net",
            "NIS (er)",
            "NIS payment",
          ]}
          alignRightFrom={3}
          className="text-[11px]"
        >
          {data.rows.map((row) => (
            <ReportPrintTableRow key={row.employeeNumber + row.employeeName}>
              <ReportPrintTableCell>{row.employeeNumber}</ReportPrintTableCell>
              <ReportPrintTableCell>
                <div className="font-medium">{row.employeeName}</div>
                {row.jobTitle ? (
                  <ReportPrintMuted>{row.jobTitle}</ReportPrintMuted>
                ) : null}
              </ReportPrintTableCell>
              <ReportPrintTableCell>
                {row.departmentName ?? "—"}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {money(row.baseSalary, currency)}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {money(row.allowancesTotal, currency)}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {money(row.grossPay, currency)}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {money(row.paye, currency)}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {money(row.nisEmployee, currency)}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {money(row.healthSurcharge, currency)}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {money(row.otherDeductions, currency)}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                {money(row.totalDeductions, currency)}
              </ReportPrintTableCell>
              <ReportPrintTableCell align="right">
                <span className="font-medium">
                  {money(row.netPay, currency)}
                </span>
              </ReportPrintTableCell>
              <ReportPrintTableCell
                align="right"
                className={employerCellClass}
              >
                {money(row.nisEmployer, currency)}
              </ReportPrintTableCell>
              <ReportPrintTableCell
                align="right"
                className={nisTotalCellClass}
              >
                {money(row.nisPayment, currency)}
              </ReportPrintTableCell>
            </ReportPrintTableRow>
          ))}
          <ReportPrintTableRow>
            <ReportPrintTableCell>{""}</ReportPrintTableCell>
            <ReportPrintTableCell>
              <span className="font-semibold">TOTAL</span>
            </ReportPrintTableCell>
            <ReportPrintTableCell>{""}</ReportPrintTableCell>
            <ReportPrintTableCell align="right">
              <span className="font-semibold">
                {money(totals.baseSalary, currency)}
              </span>
            </ReportPrintTableCell>
            <ReportPrintTableCell align="right">
              <span className="font-semibold">
                {money(totals.allowancesTotal, currency)}
              </span>
            </ReportPrintTableCell>
            <ReportPrintTableCell align="right">
              <span className="font-semibold">
                {money(totals.grossPay, currency)}
              </span>
            </ReportPrintTableCell>
            <ReportPrintTableCell align="right">
              <span className="font-semibold">
                {money(totals.paye, currency)}
              </span>
            </ReportPrintTableCell>
            <ReportPrintTableCell align="right">
              <span className="font-semibold">
                {money(totals.nisEmployee, currency)}
              </span>
            </ReportPrintTableCell>
            <ReportPrintTableCell align="right">
              <span className="font-semibold">
                {money(totals.healthSurcharge, currency)}
              </span>
            </ReportPrintTableCell>
            <ReportPrintTableCell align="right">
              <span className="font-semibold">
                {money(totals.otherDeductions, currency)}
              </span>
            </ReportPrintTableCell>
            <ReportPrintTableCell align="right">
              <span className="font-semibold">
                {money(totals.totalDeductions, currency)}
              </span>
            </ReportPrintTableCell>
            <ReportPrintTableCell align="right">
              <span className="font-semibold">
                {money(totals.netPay, currency)}
              </span>
            </ReportPrintTableCell>
            <ReportPrintTableCell
              align="right"
              className={cn(employerCellClass, "font-semibold")}
            >
              {money(totals.nisEmployer, currency)}
            </ReportPrintTableCell>
            <ReportPrintTableCell
              align="right"
              className={cn(nisTotalCellClass, "font-semibold")}
            >
              {money(totals.nisPayment, currency)}
            </ReportPrintTableCell>
          </ReportPrintTableRow>
        </ReportPrintTable>
      </ReportPrintSection>

      {data.excludedRows.length > 0 ? (
        <ReportPrintSection title="Excluded from this run">
          <ReportPrintTable headers={["Emp #", "Employee", "Reason"]}>
            {data.excludedRows.map((row) => (
              <ReportPrintTableRow
                key={`ex-${row.employeeNumber}-${row.employeeName}`}
              >
                <ReportPrintTableCell>{row.employeeNumber}</ReportPrintTableCell>
                <ReportPrintTableCell>{row.employeeName}</ReportPrintTableCell>
                <ReportPrintTableCell>
                  {row.exclusionReason ?? "Excluded"}
                </ReportPrintTableCell>
              </ReportPrintTableRow>
            ))}
          </ReportPrintTable>
        </ReportPrintSection>
      ) : null}
    </div>
  );
}
