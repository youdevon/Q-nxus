import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import type { MonthlyPayrollReportData } from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { formatPayrollPeriodRangeLabel } from "@/src/modules/payroll/lib/payroll-analytics";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import {
  ReportEmptyState,
  ReportExportLinks,
  ReportPrintLink,
} from "@/src/modules/reports/components/report-layout";
import { reportPrintHref } from "@/src/modules/reports/lib/report-print";
import { MonthlyPayrollScopeFields } from "./monthly-payroll-scope-fields";
import { PostedPayrollRegisterDocument } from "./posted-payroll-register-document";
import { PayrollNav } from "./payroll-nav";

const PRESETS = [
  { value: "custom", label: "Custom range" },
  { value: "this_year", label: "This year" },
  { value: "previous_year", label: "Previous year" },
  { value: "last_3", label: "Last 3 months" },
  { value: "last_6", label: "Last 6 months" },
  { value: "last_12", label: "Last 12 months" },
] as const;

function appendEmployeeIds(
  params: URLSearchParams,
  employees: MonthlyPayrollReportData["selectedEmployees"],
) {
  for (const employee of employees) {
    params.append("employeeIds", employee.id);
  }
}

function scopeLabel(data: MonthlyPayrollReportData): string {
  if (data.scope === "selected") {
    return `${data.selectedEmployees.length} employee${
      data.selectedEmployees.length === 1 ? "" : "s"
    } selected`;
  }
  if (data.scope === "department") {
    return data.selectedDepartmentName ?? "Department";
  }
  return "All employees";
}

export function MonthlyPayrollReport({
  data,
}: {
  data: MonthlyPayrollReportData;
}) {
  const {
    summary,
    period,
    availablePeriodKeys,
    scope,
    selectedEmployees,
    departments,
    selectedDepartmentId,
    register,
    generated,
  } = data;
  const periodLabel =
    summary.periodName ??
    formatPayrollPeriodRangeLabel(period.startPeriodKey, period.endPeriodKey);
  const optionKeys = [...new Set(availablePeriodKeys)].sort((a, b) =>
    b.localeCompare(a),
  );
  const waitingForSelection =
    (scope === "selected" && selectedEmployees.length === 0) ||
    (scope === "department" && !selectedDepartmentId);

  const exportParams = new URLSearchParams({
    preset: period.preset,
    start: period.startPeriodKey,
    end: period.endPeriodKey,
    scope,
    generated: "1",
  });
  appendEmployeeIds(exportParams, selectedEmployees);
  if (selectedDepartmentId) {
    exportParams.set("departmentId", selectedDepartmentId);
  }
  const exportHref = `/payroll/reports/monthly/export?${exportParams.toString()}`;
  const printHref = reportPrintHref("/payroll/reports/monthly", {
    preset: period.preset,
    start: period.startPeriodKey,
    end: period.endPeriodKey,
    scope,
    employeeIds: selectedEmployees.map((employee) => employee.id).join(","),
    departmentId: selectedDepartmentId ?? undefined,
    generated: "1",
  });

  return (
    <PageShell size="xl">
      <PayrollNav />

      <PageHeader
        title="Posted payroll"
        description="Generate a pay-run style payroll register from posted payslips — all employees, selected people, or a department. Multi-employee amounts are auto-calculated for the period."
        backHref="/reports"
        backLabel="Reports"
        actions={
          generated ? (
            <PageActionsEnd>
              <ReportPrintLink href={printHref} label="View / print" />
              <ReportExportLinks href={exportHref} />
            </PageActionsEnd>
          ) : undefined
        }
      />

      <form
        method="get"
        action="/payroll/reports/monthly"
        className="mb-8 space-y-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-4"
      >
        <MonthlyPayrollScopeFields
          initialScope={scope}
          initialSelectedEmployees={selectedEmployees}
          departments={departments}
          selectedDepartmentId={selectedDepartmentId}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Period</span>
            <select
              name="preset"
              defaultValue={period.preset}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Start month</span>
            <Input
              type="month"
              name="start"
              defaultValue={period.startPeriodKey}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">End month</span>
            <Input
              type="month"
              name="end"
              defaultValue={period.endPeriodKey}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit" name="generated" value="1">
              Generate report
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          The generated document matches a pay-run register (basic, allowances,
          gross, PAYE, NIS, health, deductions, net). Excel uses the standard
          document font size. Corrections and off-cycle runs are included.
        </p>
        {optionKeys.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Posted months available:{" "}
            {optionKeys
              .slice(0, 6)
              .map((key) => formatPayslipPeriodLabel(key) ?? key)
              .join(", ")}
            {optionKeys.length > 6 ? "…" : ""}
          </p>
        ) : null}
      </form>

      {!generated ? (
        <ReportEmptyState
          message={
            waitingForSelection
              ? scope === "department"
                ? "Select a department, then generate the report."
                : "Add at least one employee, then generate the report."
              : "No report yet."
          }
          hint={
            waitingForSelection
              ? scope === "department"
                ? "Choose a department and period, then click Generate report."
                : "Use Find employees to search by name, number, or email, add people, then click Generate report."
              : "Choose employees (all, selected, or department) and a period, then click Generate report."
          }
        />
      ) : null}

      {generated ? (
        <>
          <section className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {scopeLabel(data)} · Report generated for this session.
            </p>
            <div className="flex flex-wrap gap-2">
              <ReportPrintLink href={printHref} label="View / print" />
              <ReportExportLinks href={exportHref} />
              <Button
                nativeButton={false}
                size="sm"
                variant="outline"
                render={<Link href="/payroll/reports/monthly" />}
              >
                Clear report
              </Button>
            </div>
          </section>

          {!register || register.payslipCount === 0 ? (
            <ReportEmptyState
              message={`No posted payslips for ${periodLabel}.`}
              hint="Choose another period or different employees and click Generate report."
            />
          ) : (
            <PostedPayrollRegisterDocument
              register={register}
              periodLabel={periodLabel}
            />
          )}
        </>
      ) : null}
    </PageShell>
  );
}
