import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  assembleEmployeePaymentHistory,
  assembleEmployeePaymentRoster,
  extractEmployerContributionFromSnapshot,
  resolveEmployeeHistoryPeriodRange,
  resolveEmployeePaymentHistoryScope,
  type EmployeeHistoryPeriodPreset,
  type EmployeePaymentHistory,
  type EmployeePaymentHistoryScope,
  type EmployeePaymentRoster,
  type PostedPayslipAnalyticsRow,
} from "@/src/modules/payroll/lib/payroll-analytics";
import { parseMonthlyPeriodKey } from "@/src/modules/payroll/lib/pay-period";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";

const EMPLOYEE_SEARCH_LIMIT = 25;

export type EmployeePaymentHistoryMatch = {
  id: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
};

export type EmployeePaymentHistoryDepartmentOption = {
  id: string;
  name: string;
};

export type EmployeePaymentHistoryReportData = {
  scope: EmployeePaymentHistoryScope;
  query: string;
  matches: EmployeePaymentHistoryMatch[];
  selectedEmployee: EmployeePaymentHistoryMatch | null;
  departments: EmployeePaymentHistoryDepartmentOption[];
  selectedDepartmentId: string | null;
  selectedDepartmentName: string | null;
  period: {
    preset: EmployeeHistoryPeriodPreset;
    startPeriodKey: string;
    endPeriodKey: string;
  };
  history: EmployeePaymentHistory | null;
  roster: EmployeePaymentRoster | null;
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

function employeeSearchWhere(query: string): Prisma.EmployeeWhereInput {
  return {
    isArchived: false,
    OR: [
      {
        employeeNumber: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        firstName: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        lastName: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        preferredName: {
          contains: query,
          mode: "insensitive",
        },
      },
    ],
  };
}

const payslipSelect = {
  id: true,
  employeeId: true,
  employeeNumber: true,
  employeeName: true,
  currency: true,
  grossPay: true,
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
} as const;

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

async function getEmployeeMatch(
  employeeId: string,
): Promise<EmployeePaymentHistoryMatch | null> {
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      isArchived: false,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      department: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!employee) {
    return null;
  }

  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    displayName: displayName(employee),
    departmentName: employee.department?.name ?? null,
  };
}

async function searchEmployees(
  query: string,
): Promise<EmployeePaymentHistoryMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const employees = await prisma.employee.findMany({
    where: employeeSearchWhere(trimmed),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: EMPLOYEE_SEARCH_LIMIT,
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      department: {
        select: {
          name: true,
        },
      },
    },
  });

  return employees.map((employee) => ({
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    displayName: displayName(employee),
    departmentName: employee.department?.name ?? null,
  }));
}

async function listDepartments(): Promise<
  EmployeePaymentHistoryDepartmentOption[]
> {
  return prisma.department.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });
}

async function loadDepartmentsByEmployeeId(
  employeeIds: string[],
): Promise<Map<string, string | null>> {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  const map = new Map<string, string | null>();

  if (uniqueIds.length === 0) {
    return map;
  }

  const employees = await prisma.employee.findMany({
    where: {
      id: { in: uniqueIds },
    },
    select: {
      id: true,
      department: {
        select: {
          name: true,
        },
      },
    },
  });

  for (const employee of employees) {
    map.set(employee.id, employee.department?.name ?? null);
  }

  return map;
}

async function loadPostedPayslipsInRange(input: {
  startPeriodKey: string;
  endPeriodKey: string;
  employeeId?: string;
  departmentId?: string;
}): Promise<PostedPayslipAnalyticsRow[]> {
  const payslips = await prisma.payslip.findMany({
    where: {
      status: "POSTED",
      ...(input.employeeId
        ? { employeeId: input.employeeId }
        : input.departmentId
          ? { employee: { departmentId: input.departmentId } }
          : {}),
      payrollPeriod: {
        periodKey: {
          gte: input.startPeriodKey,
          lte: input.endPeriodKey,
        },
      },
    },
    select: payslipSelect,
    orderBy: [
      {
        payrollPeriod: {
          periodEnd: "asc",
        },
      },
      {
        createdAt: "asc",
      },
    ],
  });

  return payslips.map(mapPostedRow);
}

function emptyPeriodShell(input: {
  scope: EmployeePaymentHistoryScope;
  query: string;
  matches: EmployeePaymentHistoryMatch[];
  selectedEmployee: EmployeePaymentHistoryMatch | null;
  departments: EmployeePaymentHistoryDepartmentOption[];
  selectedDepartmentId: string | null;
  selectedDepartmentName: string | null;
  period: EmployeePaymentHistoryReportData["period"];
}): EmployeePaymentHistoryReportData {
  return {
    ...input,
    history: null,
    roster: null,
  };
}

/**
 * Posted payment history report — all employees, one employee, or a department.
 * Only POSTED payslips; draft / EXCLUDED never count.
 */
export async function getEmployeePaymentHistory(input: {
  scope?: string | null;
  employeeId?: string | null;
  departmentId?: string | null;
  query?: string | null;
  preset?: string | null;
  startPeriodKey?: string | null;
  endPeriodKey?: string | null;
}): Promise<EmployeePaymentHistoryReportData> {
  const period = resolveEmployeeHistoryPeriodRange({
    preset: input.preset,
    startPeriodKey: input.startPeriodKey,
    endPeriodKey: input.endPeriodKey,
  });

  const query = input.query?.trim() ?? "";
  const employeeId = input.employeeId?.trim() || null;
  const departmentId = input.departmentId?.trim() || null;
  const scope = resolveEmployeePaymentHistoryScope(input.scope, {
    employeeId,
  });

  const [departments, selectedEmployee, matches] = await Promise.all([
    listDepartments(),
    scope === "employee" && employeeId
      ? getEmployeeMatch(employeeId)
      : Promise.resolve(null),
    scope === "employee" ? searchEmployees(query) : Promise.resolve([]),
  ]);

  const selectedDepartment =
    scope === "department" && departmentId
      ? (departments.find((department) => department.id === departmentId) ??
        null)
      : null;

  const base = {
    scope,
    query,
    matches,
    selectedEmployee,
    departments,
    selectedDepartmentId: selectedDepartment?.id ?? null,
    selectedDepartmentName: selectedDepartment?.name ?? null,
    period,
  };

  const startParsed = parseMonthlyPeriodKey(period.startPeriodKey);
  const endParsed = parseMonthlyPeriodKey(period.endPeriodKey);
  if (!startParsed || !endParsed) {
    return emptyPeriodShell(base);
  }

  if (scope === "employee") {
    if (!selectedEmployee) {
      return emptyPeriodShell(base);
    }

    const rows = await loadPostedPayslipsInRange({
      startPeriodKey: period.startPeriodKey,
      endPeriodKey: period.endPeriodKey,
      employeeId: selectedEmployee.id,
    });

    return {
      ...base,
      history: assembleEmployeePaymentHistory({
        employeeId: selectedEmployee.id,
        startPeriodKey: period.startPeriodKey,
        endPeriodKey: period.endPeriodKey,
        rows,
      }),
      roster: null,
    };
  }

  if (scope === "department" && !selectedDepartment) {
    return emptyPeriodShell(base);
  }

  const rows = await loadPostedPayslipsInRange({
    startPeriodKey: period.startPeriodKey,
    endPeriodKey: period.endPeriodKey,
    departmentId: selectedDepartment?.id,
  });

  const departmentsByEmployeeId = await loadDepartmentsByEmployeeId(
    rows.map((row) => row.employeeId),
  );

  return {
    ...base,
    history: null,
    roster: assembleEmployeePaymentRoster({
      startPeriodKey: period.startPeriodKey,
      endPeriodKey: period.endPeriodKey,
      rows,
      departmentsByEmployeeId,
    }),
  };
}
