import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  assembleEmployeePaymentHistory,
  extractEmployerContributionFromSnapshot,
  resolveEmployeeHistoryPeriodRange,
  type EmployeeHistoryPeriodPreset,
  type EmployeePaymentHistory,
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

export type EmployeePaymentHistoryReportData = {
  query: string;
  matches: EmployeePaymentHistoryMatch[];
  selectedEmployee: EmployeePaymentHistoryMatch | null;
  period: {
    preset: EmployeeHistoryPeriodPreset;
    startPeriodKey: string;
    endPeriodKey: string;
  };
  history: EmployeePaymentHistory | null;
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

/**
 * Posted payment history for one employee over an inclusive month range.
 * Only POSTED payslips; draft / EXCLUDED never count.
 */
export async function getEmployeePaymentHistory(input: {
  employeeId?: string | null;
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

  const [selectedEmployee, matches] = await Promise.all([
    employeeId ? getEmployeeMatch(employeeId) : Promise.resolve(null),
    searchEmployees(query),
  ]);

  if (!selectedEmployee) {
    return {
      query,
      matches,
      selectedEmployee: null,
      period,
      history: null,
    };
  }

  const startParsed = parseMonthlyPeriodKey(period.startPeriodKey);
  const endParsed = parseMonthlyPeriodKey(period.endPeriodKey);

  if (!startParsed || !endParsed) {
    return {
      query,
      matches,
      selectedEmployee,
      period,
      history: assembleEmployeePaymentHistory({
        employeeId: selectedEmployee.id,
        startPeriodKey: period.startPeriodKey,
        endPeriodKey: period.endPeriodKey,
        rows: [],
      }),
    };
  }

  const payslips = await prisma.payslip.findMany({
    where: {
      employeeId: selectedEmployee.id,
      status: "POSTED",
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
    },
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

  const rows = payslips.map(mapPostedRow);
  const history = assembleEmployeePaymentHistory({
    employeeId: selectedEmployee.id,
    startPeriodKey: period.startPeriodKey,
    endPeriodKey: period.endPeriodKey,
    rows,
  });

  return {
    query,
    matches,
    selectedEmployee,
    period,
    history,
  };
}
