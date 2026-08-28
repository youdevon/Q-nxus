import { formatMoney, formatDisplayDate } from "@/src/lib/format";
import type { EmployeePaymentHistoryReportData } from "@/src/modules/payroll/data/get-employee-payment-history";
import type { MonthlyPayrollReportData } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import type { StatutoryRemittanceReport } from "@/src/modules/payroll/data/get-statutory-remittance";
import type { YearEndEmployeeSummary } from "@/src/modules/payroll/data/get-year-end-payroll-summary";
import {
  runKindLabel,
  type PayrollMoneyTotals,
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

function moneySummaryItems(
  totals: PayrollMoneyTotals[],
  mixed: boolean,
): Array<{ label: string; value: string }> {
  if (totals.length === 0) {
    return [];
  }

  if (mixed) {
    return totals.flatMap((total) => [
      {
        label: `Gross (${total.currency})`,
        value: formatMoney(total.grossPay, { currency: total.currency }),
      },
      {
        label: `Net (${total.currency})`,
        value: formatMoney(total.netPay, { currency: total.currency }),
      },
    ]);
  }

  const total = totals[0];
  return [
    {
      label: "Gross",
      value: formatMoney(total.grossPay, { currency: total.currency }),
    },
    {
      label: "Deductions",
      value: formatMoney(total.totalDeductions, { currency: total.currency }),
    },
    {
      label: "Net",
      value: formatMoney(total.netPay, { currency: total.currency }),
    },
    {
      label: "Employer contributions",
      value: formatMoney(total.employerContributions, {
        currency: total.currency,
      }),
    },
    {
      label: "Org payroll cost",
      value: formatMoney(total.organizationCost, { currency: total.currency }),
    },
  ];
}

function currencyStack(
  totals: PayrollMoneyTotals[],
  field: keyof Pick<
    PayrollMoneyTotals,
    "grossPay" | "totalDeductions" | "netPay" | "employerContributions"
  >,
) {
  return totals.map((total) => (
    <div key={total.currency}>
      {formatMoney(total[field], { currency: total.currency })}
    </div>
  ));
}

export function MonthlyPayrollReportPrintContent({
  data,
}: {
  data: MonthlyPayrollReportData;
}) {
  const { summary, selectedPeriodKey } = data;
  const periodLabel =
    summary.periodName ??
    formatPayslipPeriodLabel(selectedPeriodKey) ??
    selectedPeriodKey;
  const mixed = summary.totalsByCurrency.length > 1;

  if (summary.payslipCount === 0) {
    return (
      <ReportPrintEmptyState
        message={`No posted payslips for ${periodLabel}.`}
      />
    );
  }

  return (
    <>
      <ReportPrintSummaryGrid
        items={[
          { label: "Payslips", value: summary.payslipCount },
          { label: "Employees", value: summary.employeeCount },
          ...moneySummaryItems(summary.totalsByCurrency, mixed),
        ]}
      />

      {summary.byRunKind.length > 0 ? (
        <ReportPrintSection title="By run type">
          <ReportPrintTable
            headers={["Run type", "Gross", "Net", "Employer", "Slips / people"]}
            alignRightFrom={1}
          >
            {summary.byRunKind.map((item) => (
              <ReportPrintTableRow key={`${item.runKind}-${item.currency}`}>
                <ReportPrintTableCell>
                  {runKindLabel(item.runKind)}
                  {mixed ? ` (${item.currency})` : ""}
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {formatMoney(item.grossPay, { currency: item.currency })}
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {formatMoney(item.netPay, { currency: item.currency })}
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {formatMoney(item.employerContributions, {
                    currency: item.currency,
                  })}
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {item.payslipCount} / {item.employeeCount}
                </ReportPrintTableCell>
              </ReportPrintTableRow>
            ))}
          </ReportPrintTable>
        </ReportPrintSection>
      ) : null}

      {summary.runs.length > 0 ? (
        <ReportPrintSection title="Posted runs">
          <ReportPrintTable
            headers={["Run", "Gross", "Net", "Posted"]}
            alignRightFrom={1}
          >
            {summary.runs.map((run) => (
              <ReportPrintTableRow key={`${run.payRunId}-${run.currency}`}>
                <ReportPrintTableCell>
                  <div>{run.runNumber}</div>
                  <ReportPrintMuted>
                    {run.employeeCount} employees · {run.payslipCount} payslips
                    {mixed ? ` · ${run.currency}` : ""}
                    {run.runKind !== "REGULAR"
                      ? ` · ${runKindLabel(run.runKind)}`
                      : ""}
                  </ReportPrintMuted>
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {formatMoney(run.grossPay, { currency: run.currency })}
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {formatMoney(run.netPay, { currency: run.currency })}
                </ReportPrintTableCell>
                <ReportPrintTableCell>
                  {formatDisplayDate(run.postedAt, { fallback: "—" })}
                </ReportPrintTableCell>
              </ReportPrintTableRow>
            ))}
          </ReportPrintTable>
        </ReportPrintSection>
      ) : null}
    </>
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
          title={mixed ? `Statutory totals (${total.currency})` : "Statutory totals"}
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

export function EmployeePaymentHistoryReportPrintContent({
  data,
}: {
  data: EmployeePaymentHistoryReportData;
}) {
  const {
    scope,
    period,
    selectedEmployee,
    history,
    roster,
    selectedDepartmentName,
  } = data;
  const mixed =
    (history?.totalsByCurrency.length ?? roster?.totalsByCurrency.length ?? 0) >
    1;
  const periodLabel = `${formatPayslipPeriodLabel(period.startPeriodKey) ?? period.startPeriodKey} – ${formatPayslipPeriodLabel(period.endPeriodKey) ?? period.endPeriodKey}`;

  if (scope === "employee" && selectedEmployee && history) {
    if (history.payslipCount === 0) {
      return (
        <ReportPrintEmptyState
          message={`No posted payslips for ${selectedEmployee.displayName} in ${periodLabel}.`}
        />
      );
    }

    return (
      <>
        <ReportPrintSummaryGrid
          items={[
            { label: "Employee", value: selectedEmployee.displayName },
            { label: "Period", value: periodLabel },
            { label: "Payslips", value: history.payslipCount },
            ...moneySummaryItems(history.totalsByCurrency, mixed),
          ]}
        />

        <ReportPrintSection title="Monthly breakdown">
          <ReportPrintTable
            headers={["Period", "Run", "Gross", "Net", "Employer"]}
            alignRightFrom={2}
          >
            {history.months.flatMap((month) =>
              month.payslips.map((slip) => (
                <ReportPrintTableRow key={slip.payslipId}>
                  <ReportPrintTableCell>{month.periodName}</ReportPrintTableCell>
                  <ReportPrintTableCell>
                    <div>{slip.runNumber}</div>
                    {slip.runKind !== "REGULAR" ? (
                      <ReportPrintMuted>{runKindLabel(slip.runKind)}</ReportPrintMuted>
                    ) : null}
                  </ReportPrintTableCell>
                  <ReportPrintTableCell align="right">
                    {formatMoney(slip.grossPay, { currency: slip.currency })}
                  </ReportPrintTableCell>
                  <ReportPrintTableCell align="right">
                    {formatMoney(slip.netPay, { currency: slip.currency })}
                  </ReportPrintTableCell>
                  <ReportPrintTableCell align="right">
                    {formatMoney(slip.employerContributions, {
                      currency: slip.currency,
                    })}
                  </ReportPrintTableCell>
                </ReportPrintTableRow>
              )),
            )}
          </ReportPrintTable>
        </ReportPrintSection>
      </>
    );
  }

  if ((scope === "all" || scope === "department") && roster) {
    if (roster.payslipCount === 0) {
      return (
        <ReportPrintEmptyState
          message={`No posted payslips in ${periodLabel}.`}
        />
      );
    }

    const scopeLabel =
      scope === "department"
        ? (selectedDepartmentName ?? "Department")
        : "All employees";

    return (
      <>
        <ReportPrintSummaryGrid
          items={[
            { label: "Scope", value: scopeLabel },
            { label: "Period", value: periodLabel },
            { label: "Employees", value: roster.employeeCount },
            { label: "Payslips", value: roster.payslipCount },
            ...moneySummaryItems(roster.totalsByCurrency, mixed),
          ]}
        />

        <ReportPrintSection title="Employees">
          <ReportPrintTable
            headers={["Employee", "Slips", "Gross", "Deductions", "Net", "Employer"]}
            alignRightFrom={1}
          >
            {roster.employees.map((employee) => (
              <ReportPrintTableRow key={employee.employeeId}>
                <ReportPrintTableCell>
                  <div>{employee.employeeName}</div>
                  <ReportPrintMuted>
                    {employee.employeeNumber}
                    {employee.departmentName
                      ? ` · ${employee.departmentName}`
                      : ""}
                  </ReportPrintMuted>
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {employee.payslipCount}
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {currencyStack(employee.totalsByCurrency, "grossPay")}
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {currencyStack(employee.totalsByCurrency, "totalDeductions")}
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {currencyStack(employee.totalsByCurrency, "netPay")}
                </ReportPrintTableCell>
                <ReportPrintTableCell align="right">
                  {currencyStack(
                    employee.totalsByCurrency,
                    "employerContributions",
                  )}
                </ReportPrintTableCell>
              </ReportPrintTableRow>
            ))}
          </ReportPrintTable>
        </ReportPrintSection>
      </>
    );
  }

  return (
    <ReportPrintEmptyState message="Select filters on the report page, then print again." />
  );
}

export function employeePaymentHistoryMetaLines(
  data: EmployeePaymentHistoryReportData,
): string[] {
  const periodLabel = `${formatPayslipPeriodLabel(data.period.startPeriodKey) ?? data.period.startPeriodKey} – ${formatPayslipPeriodLabel(data.period.endPeriodKey) ?? data.period.endPeriodKey}`;

  if (data.scope === "employee" && data.selectedEmployee) {
    return [
      `${data.selectedEmployee.displayName} (${data.selectedEmployee.employeeNumber})`,
      periodLabel,
    ];
  }

  if (data.scope === "department" && data.selectedDepartmentName) {
    return [`Department: ${data.selectedDepartmentName}`, periodLabel];
  }

  return [`All employees · ${periodLabel}`];
}
