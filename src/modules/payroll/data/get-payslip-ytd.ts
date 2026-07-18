import { prisma } from "@/lib/prisma";
import {
  assemblePayslipYtd,
  type PayslipYtdContribution,
  type PayslipYtdTotals,
  yearFromPeriodKey,
} from "@/src/modules/payroll/lib/payslip-ytd";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";

function lineAmount(payslip: PayslipPreview, label: string): number {
  return payslip.deductions
    .filter((line) => line.label === label)
    .reduce((sum, line) => sum + line.amount, 0);
}

export function payslipPreviewToYtdContribution(
  payslip: PayslipPreview,
): PayslipYtdContribution {
  return {
    grossPay: payslip.grossPay,
    totalDeductions: payslip.totalDeductions,
    netPay: payslip.netPay,
    paye: lineAmount(payslip, "PAYE (income tax)"),
    nisEmployee: lineAmount(payslip, "NIS (employee)"),
    healthSurcharge: lineAmount(payslip, "Health Surcharge"),
  };
}

function toContribution(row: {
  grossPay: { toString(): string };
  totalDeductions: { toString(): string };
  netPay: { toString(): string };
  payeAmount?: { toString(): string } | null;
  nisEmployeeAmount?: { toString(): string } | null;
  healthSurchargeAmount?: { toString(): string } | null;
  snapshot?: unknown;
}): PayslipYtdContribution {
  const hasStatutoryColumns =
    row.payeAmount != null ||
    row.nisEmployeeAmount != null ||
    row.healthSurchargeAmount != null;

  if (hasStatutoryColumns) {
    return {
      grossPay: Number(row.grossPay.toString()),
      totalDeductions: Number(row.totalDeductions.toString()),
      netPay: Number(row.netPay.toString()),
      paye: Number(row.payeAmount?.toString() ?? 0),
      nisEmployee: Number(row.nisEmployeeAmount?.toString() ?? 0),
      healthSurcharge: Number(row.healthSurchargeAmount?.toString() ?? 0),
    };
  }

  const snapshot = parsePayslipSnapshot(row.snapshot);
  if (snapshot) {
    return payslipPreviewToYtdContribution(snapshot.payslip);
  }

  return {
    grossPay: Number(row.grossPay.toString()),
    totalDeductions: Number(row.totalDeductions.toString()),
    netPay: Number(row.netPay.toString()),
    paye: 0,
    nisEmployee: 0,
    healthSurcharge: 0,
  };
}

type PostedYtdCandidate = {
  id: string;
  employeeId: string;
  grossPay: { toString(): string };
  totalDeductions: { toString(): string };
  netPay: { toString(): string };
  payeAmount: { toString(): string };
  nisEmployeeAmount: { toString(): string };
  healthSurchargeAmount: { toString(): string };
  createdAt: Date;
  payrollPeriod: { periodEnd: Date };
  payRun: { postedAt: Date | null };
};

function assemblePostedYtdFromCandidates(input: {
  year: number;
  periodEnd: Date;
  postedAt: Date | null;
  createdAt: Date;
  payslipId: string;
  current: PayslipYtdContribution;
  candidates: PostedYtdCandidate[];
}): PayslipYtdTotals {
  const currentMarker = input.postedAt?.getTime() ?? input.createdAt.getTime();
  const inputEnd = input.periodEnd.getTime();

  const prior = input.candidates.filter((row) => {
    if (row.id === input.payslipId) {
      return false;
    }

    const rowEnd = row.payrollPeriod.periodEnd.getTime();
    if (rowEnd < inputEnd) {
      return true;
    }

    const rowMarker =
      row.payRun.postedAt?.getTime() ?? row.createdAt.getTime();
    return rowMarker < currentMarker;
  });

  return assemblePayslipYtd({
    year: input.year,
    priorPosted: prior.map(toContribution),
    current: input.current,
  });
}

/**
 * YTD for a posted payslip: earlier posted slips in the same calendar year
 * (by period end, then postedAt), plus this slip.
 * Same-period corrections include the earlier regular posted slip.
 */
export async function getPostedPayslipYtd(input: {
  employeeId: string;
  payslipId: string;
  year: number;
  periodEnd: Date;
  postedAt: Date | null;
  createdAt: Date;
  current: PayslipYtdContribution;
}): Promise<PayslipYtdTotals> {
  const candidates = await prisma.payslip.findMany({
    where: {
      employeeId: input.employeeId,
      status: "POSTED",
      id: { not: input.payslipId },
      payrollPeriod: {
        year: input.year,
        periodEnd: { lte: input.periodEnd },
      },
    },
    select: {
      id: true,
      employeeId: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      payeAmount: true,
      nisEmployeeAmount: true,
      healthSurchargeAmount: true,
      createdAt: true,
      payrollPeriod: {
        select: { periodEnd: true },
      },
      payRun: {
        select: { postedAt: true },
      },
    },
  });

  return assemblePostedYtdFromCandidates({
    year: input.year,
    periodEnd: input.periodEnd,
    postedAt: input.postedAt,
    createdAt: input.createdAt,
    payslipId: input.payslipId,
    current: input.current,
    candidates,
  });
}

/**
 * Batch posted YTD for many slips in the same calendar year / period end
 * (e.g. pay-run batch print). One query for all prior year slips.
 */
export async function getPostedPayslipYtdBatch(
  inputs: Array<{
    employeeId: string;
    payslipId: string;
    year: number;
    periodEnd: Date;
    postedAt: Date | null;
    createdAt: Date;
    current: PayslipYtdContribution;
  }>,
): Promise<Map<string, PayslipYtdTotals>> {
  const result = new Map<string, PayslipYtdTotals>();

  if (inputs.length === 0) {
    return result;
  }

  const year = inputs[0].year;
  const periodEnd = inputs[0].periodEnd;
  const employeeIds = [...new Set(inputs.map((row) => row.employeeId))];
  const excludeIds = inputs.map((row) => row.payslipId);

  const candidates = await prisma.payslip.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: "POSTED",
      id: { notIn: excludeIds },
      payrollPeriod: {
        year,
        periodEnd: { lte: periodEnd },
      },
    },
    select: {
      id: true,
      employeeId: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      payeAmount: true,
      nisEmployeeAmount: true,
      healthSurchargeAmount: true,
      createdAt: true,
      payrollPeriod: {
        select: { periodEnd: true },
      },
      payRun: {
        select: { postedAt: true },
      },
    },
  });

  const byEmployee = new Map<string, PostedYtdCandidate[]>();
  for (const row of candidates) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row);
    byEmployee.set(row.employeeId, list);
  }

  for (const input of inputs) {
    result.set(
      input.payslipId,
      assemblePostedYtdFromCandidates({
        year: input.year,
        periodEnd: input.periodEnd,
        postedAt: input.postedAt,
        createdAt: input.createdAt,
        payslipId: input.payslipId,
        current: input.current,
        candidates: byEmployee.get(input.employeeId) ?? [],
      }),
    );
  }

  return result;
}

/**
 * YTD for a live preview: posted slips in the same calendar year whose period
 * ends before the preview period end, plus the preview totals.
 */
export async function getPreviewPayslipYtd(input: {
  employeeId: string;
  periodKey: string;
  current: PayslipYtdContribution;
}): Promise<PayslipYtdTotals> {
  const map = await getPreviewPayslipYtdBatch([input]);
  return (
    map.get(input.employeeId) ??
    assemblePayslipYtd({
      year: yearFromPeriodKey(input.periodKey) ?? new Date().getFullYear(),
      priorPosted: [],
      current: input.current,
    })
  );
}

/**
 * Batch preview YTD for many employees in the same period key.
 * One query for all prior posted slips in that year.
 */
export async function getPreviewPayslipYtdBatch(
  inputs: Array<{
    employeeId: string;
    periodKey: string;
    current: PayslipYtdContribution;
  }>,
): Promise<Map<string, PayslipYtdTotals>> {
  const result = new Map<string, PayslipYtdTotals>();

  if (inputs.length === 0) {
    return result;
  }

  const periodKey = inputs[0].periodKey;
  const year = yearFromPeriodKey(periodKey);

  if (year == null) {
    const fallbackYear = new Date().getFullYear();
    for (const input of inputs) {
      result.set(
        input.employeeId,
        assemblePayslipYtd({
          year: fallbackYear,
          priorPosted: [],
          current: input.current,
        }),
      );
    }
    return result;
  }

  const [periodYear, periodMonth] = periodKey.split("-").map(Number);
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0, 12));
  const employeeIds = [...new Set(inputs.map((row) => row.employeeId))];

  const priorRows = await prisma.payslip.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: "POSTED",
      payrollPeriod: {
        year,
        periodEnd: { lt: periodEnd },
      },
    },
    select: {
      employeeId: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      payeAmount: true,
      nisEmployeeAmount: true,
      healthSurchargeAmount: true,
    },
  });

  const priorByEmployee = new Map<string, PayslipYtdContribution[]>();
  for (const row of priorRows) {
    const list = priorByEmployee.get(row.employeeId) ?? [];
    list.push(toContribution(row));
    priorByEmployee.set(row.employeeId, list);
  }

  for (const input of inputs) {
    result.set(
      input.employeeId,
      assemblePayslipYtd({
        year,
        priorPosted: priorByEmployee.get(input.employeeId) ?? [],
        current: input.current,
      }),
    );
  }

  return result;
}
