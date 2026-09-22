"use client";

import { useState } from "react";

import type {
  MonthlyPayrollDepartmentOption,
  MonthlyPayrollEmployeeMatch,
  MonthlyPayrollScope,
} from "@/src/modules/payroll/data/get-monthly-payroll-summary";
import { MonthlyPayrollEmployeePicker } from "./monthly-payroll-employee-picker";

const SCOPES = [
  { value: "all", label: "All employees" },
  { value: "selected", label: "Selected employees" },
  { value: "department", label: "Department" },
] as const;

export function MonthlyPayrollScopeFields({
  initialScope,
  initialSelectedEmployees,
  departments,
  selectedDepartmentId,
}: {
  initialScope: MonthlyPayrollScope;
  initialSelectedEmployees: MonthlyPayrollEmployeeMatch[];
  departments: MonthlyPayrollDepartmentOption[];
  selectedDepartmentId: string | null;
}) {
  const [scope, setScope] = useState<MonthlyPayrollScope>(initialScope);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">Employees</span>
        <select
          name="scope"
          value={scope}
          onChange={(event) =>
            setScope(event.target.value as MonthlyPayrollScope)
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {SCOPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {scope === "selected" ? (
        <MonthlyPayrollEmployeePicker
          initialSelected={initialSelectedEmployees}
        />
      ) : null}

      {scope === "department" ? (
        <label className="grid gap-1.5 text-sm sm:col-span-2 lg:col-span-3">
          <span className="text-muted-foreground">Department</span>
          <select
            name="departmentId"
            defaultValue={selectedDepartmentId ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {scope === "all" ? (
        <p className="self-end pb-2 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
          Include every employee with posted payslips in the selected period.
          Switch to Selected employees or Department to narrow the report.
        </p>
      ) : null}
    </div>
  );
}
