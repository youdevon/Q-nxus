import { prisma } from "@/lib/prisma";
import {
  assembleMonthlyPayrollSummary,
  extractEmployerContributionFromSnapshot,
  resolveDefaultMonthlyReportPeriodKey,
  type MonthlyPayrollSummary,
  type PostedPayslipAnalyticsRow,
} from "@/src/modules/payroll/lib/payroll-analytics";
import {
  buildMonthlyPeriodBounds,
  parseMonthlyPeriodKey,
} from "@/src/modules/payroll/lib/pay-period";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";

export type MonthlyPayrollReportData = {
  selectedPeriodKey: string;
  availablePeriodKeys: string[];
  summary: MonthlyPayrollSummary;
};

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
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

/** Distinct period keys that have at least one POSTED (non-excluded) payslip. */
export async function listPostedPayrollPeriodKeys(): Promise<string[]> {
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
    orderBy: [{ periodEnd: "desc" }],
  });

  return [
    ...new Set(
      periods
        .map((period) => period.periodKey)
        .filter((key) => parseMonthlyPeriodKey(key) != null),
    ),
  ];
}

/**
 * Organization monthly payroll summary from POSTED payslip snapshots only.
 * Draft / EXCLUDED slips are never included.
 */
export async function getMonthlyPayrollSummary(input?: {
  periodKey?: string | null;
}): Promise<MonthlyPayrollReportData> {
  const availablePeriodKeys = await listPostedPayrollPeriodKeys();
  const requested = input?.periodKey?.trim() ?? "";
  const selectedPeriodKey = parseMonthlyPeriodKey(requested)
    ? requested
    : resolveDefaultMonthlyReportPeriodKey({
        postedPeriodKeys: availablePeriodKeys,
      });

  const bounds = buildMonthlyPeriodBounds(selectedPeriodKey);
  const periodName =
    bounds?.name ??
    formatPayslipPeriodLabel(selectedPeriodKey) ??
    selectedPeriodKey;

  const payslips = await prisma.payslip.findMany({
    where: {
      status: "POSTED",
      payrollPeriod: {
        periodKey: selectedPeriodKey,
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
  });

  const rows = payslips.map(mapPostedRow);
  const summary = assembleMonthlyPayrollSummary({
    periodKey: selectedPeriodKey,
    periodName,
    rows,
  });

  return {
    selectedPeriodKey,
    availablePeriodKeys,
    summary,
  };
}
