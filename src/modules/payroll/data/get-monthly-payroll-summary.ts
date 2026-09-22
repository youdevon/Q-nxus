import { prisma } from "@/lib/prisma";
import {
  assembleMonthlyPayrollSummary,
  extractEmployerContributionFromSnapshot,
  formatPayrollPeriodRangeLabel,
  resolveDefaultMonthlyReportPeriodKey,
  resolveEmployeeHistoryPeriodRange,
  type MonthlyPayrollSummary,
  type PostedPayslipAnalyticsRow,
  type ResolvedPeriodRange,
} from "@/src/modules/payroll/lib/payroll-analytics";
import { parseMonthlyPeriodKey } from "@/src/modules/payroll/lib/pay-period";
import {
  assemblePayrollRegisterDocument,
  mapPayslipToRegisterSource,
  type PayrollRegisterDocument,
} from "@/src/modules/payroll/lib/payroll-register-document";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";

export type MonthlyPayrollScope = "all" | "selected" | "department";

export type MonthlyPayrollEmployeeMatch = {
  id: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
};

export type MonthlyPayrollDepartmentOption = {
  id: string;
  name: string;
};

export type MonthlyPayrollReportData = {
  /** Resolved inclusive period (preset + start/end keys). */
  period: ResolvedPeriodRange;
  /**
   * Single-month alias for older links (`?month=`).
   * Equals `period.endPeriodKey` (and start when one month is selected).
   */
  selectedPeriodKey: string;
  availablePeriodKeys: string[];
  summary: MonthlyPayrollSummary;
  scope: MonthlyPayrollScope;
  /** Employees included when scope is `selected`. */
  selectedEmployees: MonthlyPayrollEmployeeMatch[];
  departments: MonthlyPayrollDepartmentOption[];
  selectedDepartmentId: string | null;
  selectedDepartmentName: string | null;
  /**
   * Paysheet-style register document (same columns as a pay run).
   * Multi-employee rows are auto-calculated totals for the period.
   */
  register: PayrollRegisterDocument | null;
  /**
   * True only after the user clicks Generate report.
   * Fresh visits and filter-only submits leave this false (blank document).
   */
  generated: boolean;
};

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function displayName(employee: {
  firstName: string;
  lastName: string;
}): string {
  return `${employee.firstName} ${employee.lastName}`;
}

function mapPostedRow(row: {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  currency: string;
  grossPay: { toString(): string };
  totalDeductions: { toString(): string };
  netPay: { toString(): string };
  snapshot: unknown;
  payrollPeriod: {
    periodKey: string;
    name: string;
    periodEnd: Date;
  };
  payRun: {
    id: string;
    runNumber: string;
    runKind: "REGULAR" | "CORRECTION" | "OFF_CYCLE";
    postedAt: Date | null;
  };
}): PostedPayslipAnalyticsRow {
  return {
    payslipId: row.id,
    employeeId: row.employeeId,
    employeeNumber: row.employeeNumber,
    employeeName: row.employeeName,
    currency: row.currency || "TTD",
    grossPay: decimalToNumber(row.grossPay),
    totalDeductions: decimalToNumber(row.totalDeductions),
    netPay: decimalToNumber(row.netPay),
    employerContributions: extractEmployerContributionFromSnapshot(row.snapshot),
    periodKey: row.payrollPeriod.periodKey,
    periodName:
      row.payrollPeriod.name ||
      formatPayslipPeriodLabel(row.payrollPeriod.periodKey) ||
      row.payrollPeriod.periodKey,
    periodEnd: row.payrollPeriod.periodEnd.toISOString(),
    payRunId: row.payRun.id,
    runNumber: row.payRun.runNumber,
    runKind: row.payRun.runKind,
    postedAt: row.payRun.postedAt?.toISOString() ?? null,
  };
}

async function listPostedPayrollPeriodKeys(): Promise<string[]> {
  const periods = await prisma.payrollPeriod.findMany({
    where: {
      payslips: {
        some: {
          status: "POSTED",
        },
      },
    },
    select: {
      periodKey: true,
    },
    orderBy: {
      periodEnd: "desc",
    },
  });

  return periods.map((period) => period.periodKey);
}

function resolveMonthlyReportPeriod(input: {
  periodKey?: string | null;
  preset?: string | null;
  startPeriodKey?: string | null;
  endPeriodKey?: string | null;
  postedPeriodKeys: string[];
}): ResolvedPeriodRange {
  if (input.preset || input.startPeriodKey || input.endPeriodKey) {
    return resolveEmployeeHistoryPeriodRange({
      preset: input.preset,
      startPeriodKey: input.startPeriodKey,
      endPeriodKey: input.endPeriodKey,
    });
  }

  const requested = input.periodKey?.trim() ?? "";
  const selectedPeriodKey = parseMonthlyPeriodKey(requested)
    ? requested
    : resolveDefaultMonthlyReportPeriodKey({
        postedPeriodKeys: input.postedPeriodKeys,
      });

  return {
    startPeriodKey: selectedPeriodKey,
    endPeriodKey: selectedPeriodKey,
    preset: "custom",
  };
}

function resolveMonthlyScope(
  value?: string | null,
  options?: { employeeIds?: string[]; departmentId?: string | null },
): MonthlyPayrollScope {
  const raw = value?.trim();
  if (raw === "selected" || raw === "employee") {
    return "selected";
  }
  if (raw === "department") {
    return "department";
  }
  if (raw === "all") {
    return "all";
  }
  if (options?.employeeIds && options.employeeIds.length > 0) {
    return "selected";
  }
  if (options?.departmentId?.trim()) {
    return "department";
  }
  return "all";
}

export function parseMonthlyPayrollEmployeeIds(
  value: string | string[] | null | undefined,
): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const ids: string[] = [];
  for (const entry of values) {
    for (const part of entry.split(",")) {
      const id = part.trim();
      if (id && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return ids;
}

async function getEmployeeMatches(
  employeeIds: string[],
): Promise<MonthlyPayrollEmployeeMatch[]> {
  if (employeeIds.length === 0) {
    return [];
  }

  const employees = await prisma.employee.findMany({
    where: {
      id: { in: employeeIds },
      isArchived: false,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      department: {
        select: { name: true },
      },
    },
  });

  const byId = new Map(
    employees.map((employee) => [
      employee.id,
      {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        displayName: employee.preferredName
          ? `${employee.preferredName} ${employee.lastName}`
          : displayName(employee),
        departmentName: employee.department?.name ?? null,
      } satisfies MonthlyPayrollEmployeeMatch,
    ]),
  );

  return employeeIds
    .map((id) => byId.get(id) ?? null)
    .filter((row): row is MonthlyPayrollEmployeeMatch => row != null);
}

async function listDepartments(): Promise<MonthlyPayrollDepartmentOption[]> {
  return prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/**
 * Posted payroll report — all employees, selected people, or a department
 * over one month, a custom range, or year/rolling presets.
 * Draft / EXCLUDED slips are never included.
 */
export async function getMonthlyPayrollSummary(input?: {
  periodKey?: string | null;
  preset?: string | null;
  startPeriodKey?: string | null;
  endPeriodKey?: string | null;
  scope?: string | null;
  /** One or many employee ids (`employeeIds` / legacy `employeeId`). */
  employeeIds?: string | string[] | null;
  employeeId?: string | null;
  departmentId?: string | null;
  /** When false/omitted, return filter shell only — no payslip aggregation. */
  generated?: boolean | null;
}): Promise<MonthlyPayrollReportData> {
  const availablePeriodKeys = await listPostedPayrollPeriodKeys();
  const period = resolveMonthlyReportPeriod({
    periodKey: input?.periodKey,
    preset: input?.preset,
    startPeriodKey: input?.startPeriodKey,
    endPeriodKey: input?.endPeriodKey,
    postedPeriodKeys: availablePeriodKeys,
  });

  const requestedIds = parseMonthlyPayrollEmployeeIds([
    ...(Array.isArray(input?.employeeIds)
      ? input.employeeIds
      : input?.employeeIds
        ? [input.employeeIds]
        : []),
    ...(input?.employeeId ? [input.employeeId] : []),
  ]);
  const departmentId = input?.departmentId?.trim() || null;
  const scope = resolveMonthlyScope(input?.scope, {
    employeeIds: requestedIds,
    departmentId,
  });
  const generated = Boolean(input?.generated);

  const [departments, selectedEmployees] = await Promise.all([
    listDepartments(),
    scope === "selected" ? getEmployeeMatches(requestedIds) : Promise.resolve([]),
  ]);

  const selectedDepartment =
    scope === "department" && departmentId
      ? (departments.find((department) => department.id === departmentId) ??
        null)
      : null;

  const periodName = formatPayrollPeriodRangeLabel(
    period.startPeriodKey,
    period.endPeriodKey,
  );

  const emptyShell = (options?: {
    generated?: boolean;
  }): MonthlyPayrollReportData => ({
    period,
    selectedPeriodKey: period.endPeriodKey,
    availablePeriodKeys,
    summary: assembleMonthlyPayrollSummary({
      startPeriodKey: period.startPeriodKey,
      endPeriodKey: period.endPeriodKey,
      periodName,
      rows: [],
    }),
    scope,
    selectedEmployees,
    departments,
    selectedDepartmentId: selectedDepartment?.id ?? null,
    selectedDepartmentName: selectedDepartment?.name ?? null,
    register: null,
    generated: Boolean(options?.generated),
  });

  const waitingForSelection =
    (scope === "selected" && selectedEmployees.length === 0) ||
    (scope === "department" && !selectedDepartment);

  if (!generated || waitingForSelection) {
    return emptyShell();
  }

  const selectedIds = selectedEmployees.map((employee) => employee.id);

  const payslips = await prisma.payslip.findMany({
    where: {
      status: "POSTED",
      ...(scope === "selected"
        ? { employeeId: { in: selectedIds } }
        : scope === "department" && selectedDepartment
          ? { employee: { departmentId: selectedDepartment.id } }
          : {}),
      payrollPeriod: {
        periodKey: {
          gte: period.startPeriodKey,
          lte: period.endPeriodKey,
        },
      },
    },
    select: {
      id: true,
      employeeId: true,
      employeeNumber: true,
      employeeName: true,
      departmentName: true,
      jobTitle: true,
      currency: true,
      baseSalary: true,
      allowancesTotal: true,
      grossPay: true,
      payeAmount: true,
      nisEmployeeAmount: true,
      healthSurchargeAmount: true,
      totalDeductions: true,
      netPay: true,
      snapshot: true,
      payrollPeriod: {
        select: {
          periodKey: true,
          name: true,
          periodEnd: true,
        },
      },
      payRun: {
        select: {
          id: true,
          runNumber: true,
          runKind: true,
          postedAt: true,
        },
      },
    },
  });

  const rows = payslips.map(mapPostedRow);
  const registerSource = payslips.map(mapPayslipToRegisterSource);
  const summary = assembleMonthlyPayrollSummary({
    startPeriodKey: period.startPeriodKey,
    endPeriodKey: period.endPeriodKey,
    periodName,
    rows,
  });

  const register = assemblePayrollRegisterDocument({
    rows: registerSource,
  });

  return {
    period,
    selectedPeriodKey: period.endPeriodKey,
    availablePeriodKeys,
    summary,
    scope,
    selectedEmployees,
    departments,
    selectedDepartmentId: selectedDepartment?.id ?? null,
    selectedDepartmentName: selectedDepartment?.name ?? null,
    register: register.payslipCount > 0 ? register : null,
    generated: true,
  };
}
