import { cn } from "@/lib/utils";
import { formatMoney } from "@/src/lib/format";
import type { MonthlyPayrollReportData } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import type { StatutoryRemittanceReport } from "@/src/modules/payroll/data/get-statutory-remittance";
import type { YearEndEmployeeSummary } from "@/src/modules/payroll/data/get-year-end-payroll-summary";
import {
  formatPayrollPeriodRangeLabel,
  runKindLabel,
} from "@/src/modules/payroll/lib/payroll-analytics";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
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

export function MonthlyPayrollReportPrintContent({
  data,
}: {
  data: MonthlyPayrollReportData;
}) {
  const { summary, period, register } = data;
  const periodLabel =
    summary.periodName ??
    formatPayrollPeriodRangeLabel(period.startPeriodKey, period.endPeriodKey);

  if (!data.generated) {
    return (
      <ReportPrintEmptyState message="Generate the report on the Posted payroll page, then print again." />
    );
  }

  if (!register || register.payslipCount === 0) {
    return (
      <ReportPrintEmptyState
        message={`No posted payslips for ${periodLabel}.`}
      />
    );
  }

  const { currency, totals, rows, mode } = register;
  const showSlipMeta = mode === "slip";
  const headers = [
    ...(showSlipMeta ? ["Period", "Run"] : []),
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
  ];
  const alignRightFrom = showSlipMeta ? 5 : 3;

  return (
    <div className="space-y-6">
      <ReportPrintSummaryGrid
        items={[
          { label: "Employees", value: String(register.employeeCount) },
          { label: "Payslips", value: String(register.payslipCount) },
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

      <ReportPrintSection
        title={
          mode === "employee"
            ? "Payroll register (auto-calculated)"
            : "Payroll register"
        }
      >
        <ReportPrintTable
          headers={headers}
          alignRightFrom={alignRightFrom}
          className="text-[11px]"
        >
          {rows.map((row) => (
            <ReportPrintTableRow key={row.key}>
              {showSlipMeta ? (
                <>
                  <ReportPrintTableCell>
                    {row.periodName ?? "—"}
                  </ReportPrintTableCell>
                  <ReportPrintTableCell>
                    <div>{row.runNumber ?? "—"}</div>
                    {row.runKind && row.runKind !== "REGULAR" ? (
                      <ReportPrintMuted>
                        {runKindLabel(row.runKind)}
                      </ReportPrintMuted>
                    ) : null}
                  </ReportPrintTableCell>
                </>
              ) : null}
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
            {showSlipMeta ? (
              <>
                <ReportPrintTableCell>{""}</ReportPrintTableCell>
                <ReportPrintTableCell>{""}</ReportPrintTableCell>
              </>
            ) : null}
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
    </div>
  );
}

export function StatutoryRemittanceReportPrintContent({
  data,
}: {
  data: StatutoryRemittanceReport;
}) {
  const { selectedPeriodKey, totalsByCurrency, payslipCount } = data;
  const periodLabel =
    data.periodName ??
    formatPayslipPeriodLabel(selectedPeriodKey) ??
    selectedPeriodKey;
  const mixed = totalsByCurrency.length > 1;

  if (payslipCount === 0) {
    return (
      <ReportPrintEmptyState
        message={`No posted payslips for ${periodLabel}.`}
      />
    );
  }

  return (
    <>
      <ReportPrintSummaryGrid
        items={[{ label: "Posted payslips", value: payslipCount }]}
      />

      {totalsByCurrency.map((total) => (
        <ReportPrintSection
          key={total.currency}
          title={
            mixed ? `Statutory totals (${total.currency})` : "Statutory totals"
          }
        >
          <ReportPrintSummaryGrid
            items={[
              {
                label: "PAYE",
                value: formatMoney(total.paye, { currency: total.currency }),
              },
              {
                label: "NIS (employee)",
                value: formatMoney(total.nisEmployee, {
                  currency: total.currency,
                }),
              },
              {
                label: "NIS (employer)",
                value: formatMoney(total.nisEmployer, {
                  currency: total.currency,
                }),
              },
              {
                label: "Health Surcharge",
                value: formatMoney(total.health, { currency: total.currency }),
              },
              {
                label: "Total remittance",
                value: formatMoney(total.totalRemittance, {
                  currency: total.currency,
                }),
              },
            ]}
          />
        </ReportPrintSection>
      ))}
    </>
  );
}

export function YearEndPayrollReportPrintContent({
  year,
  rows,
}: {
  year: number;
  rows: YearEndEmployeeSummary[];
}) {
  if (rows.length === 0) {
    return (
      <ReportPrintEmptyState message={`No posted payslips found for ${year}.`} />
    );
  }

  return (
    <ReportPrintTable
      headers={[
        "Employee",
        "Gross",
        "PAYE",
        "NIS",
        "Health",
        "Deductions",
        "Net",
      ]}
      alignRightFrom={1}
    >
      {rows.map((row) => (
        <ReportPrintTableRow key={`${row.employeeId}-${row.currency}`}>
          <ReportPrintTableCell>
            <div>{row.employeeName}</div>
            <ReportPrintMuted>
              {row.employeeNumber} · {row.currency}
            </ReportPrintMuted>
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(row.grossPay)}
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(row.paye)}
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(row.nisEmployee)}
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(row.healthSurcharge)}
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(row.totalDeductions)}
          </ReportPrintTableCell>
          <ReportPrintTableCell align="right">
            {formatMoney(row.netPay)}
          </ReportPrintTableCell>
        </ReportPrintTableRow>
      ))}
    </ReportPrintTable>
  );
}
