import { prisma } from "@/lib/prisma";
import {
  resolveDefaultMonthlyReportPeriodKey,
} from "@/src/modules/payroll/lib/payroll-analytics";
import {
  buildMonthlyPeriodBounds,
  parseMonthlyPeriodKey,
} from "@/src/modules/payroll/lib/pay-period";
import { formatPayslipPeriodLabel } from "@/src/modules/payroll/lib/payslip-preview";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";

export type EmployeeNisDetailRow = {
  payslipId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  nisNumber: string | null;
  insurableEarnings: number;
  nisClass: string | null;
  contributionWeeks: number | null;
  nisEmployee: number;
  nisEmployer: number;
  currency: string;
  runNumber: string;
};

export type EmployeeNisDetailReport = {
  selectedPeriodKey: string;
  periodName: string;
  availablePeriodKeys: string[];
  rows: EmployeeNisDetailRow[];
};

async function listPostedPeriodKeys(organizationId: string): Promise<string[]> {
  const periods = await prisma.payrollPeriod.findMany({
    where: {
      organizationId,
      payslips: { some: { status: "POSTED" } },
    },
    select: { periodKey: true },
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

function employerNisFromSnapshot(snapshot: unknown): number {
  const parsed = parsePayslipSnapshot(snapshot);
  const fromLines =
    parsed?.payslip.employerContributions
      .filter((line) => line.label === "NIS (employer)")
      .map((line) => line.amount) ?? [];

  if (fromLines.length > 0) {
    return fromLines.reduce((sum, amount) => sum + amount, 0);
  }

  return parsed?.payslip.nis?.employerMonthly ?? 0;
}

/** Per-employee NIS breakdown from POSTED payslip snapshots for one month. */
export async function getEmployeeNisDetailReport(input?: {
  periodKey?: string | null;
  actorUserId?: string | null;
}): Promise<EmployeeNisDetailReport> {
  const organizationId = (
    await resolvePayrollOrganization({ actorUserId: input?.actorUserId })
  ).id;

  const availablePeriodKeys = await listPostedPeriodKeys(organizationId);
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
      organizationId,
      status: "POSTED",
      payrollPeriod: { periodKey: selectedPeriodKey },
    },
    orderBy: [{ employeeName: "asc" }],
    select: {
      id: true,
      employeeId: true,
      employeeNumber: true,
      employeeName: true,
      departmentName: true,
      nisNumber: true,
      currency: true,
      monthlyTaxableEarnings: true,
      nisEmployeeAmount: true,
      snapshot: true,
      payRun: { select: { runNumber: true } },
    },
  });

  const rows: EmployeeNisDetailRow[] = payslips.map((slip) => {
    const parsed = parsePayslipSnapshot(slip.snapshot);

    return {
      payslipId: slip.id,
      employeeId: slip.employeeId,
      employeeNumber: slip.employeeNumber,
      employeeName: slip.employeeName,
      departmentName: slip.departmentName,
      nisNumber: slip.nisNumber,
      insurableEarnings: Number(slip.monthlyTaxableEarnings.toString()),
      nisClass: parsed?.payslip.nis?.classCode ?? null,
      contributionWeeks: parsed?.payslip.nis?.weeksInPeriod ?? null,
      nisEmployee: Number(slip.nisEmployeeAmount.toString()),
      nisEmployer: employerNisFromSnapshot(slip.snapshot),
      currency: slip.currency || "TTD",
      runNumber: slip.payRun.runNumber,
    };
  });

  return {
    selectedPeriodKey,
    periodName,
    availablePeriodKeys,
    rows,
  };
}
