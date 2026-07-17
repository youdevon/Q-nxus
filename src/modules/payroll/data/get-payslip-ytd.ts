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
  snapshot?: unknown;
}): PayslipYtdContribution {
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
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      snapshot: true,
      createdAt: true,
      payrollPeriod: {
        select: { periodEnd: true },
      },
      payRun: {
        select: { postedAt: true },
      },
    },
  });

  const currentMarker = input.postedAt?.getTime() ?? input.createdAt.getTime();

  const prior = candidates.filter((row) => {
    const rowEnd = row.payrollPeriod.periodEnd.getTime();
    const inputEnd = input.periodEnd.getTime();

    if (rowEnd < inputEnd) {
      return true;
    }

    // Same period: include only slips posted/created before this one.
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
 * YTD for a live preview: posted slips in the same calendar year whose period
 * ends before the preview period end, plus the preview totals.
 */
export async function getPreviewPayslipYtd(input: {
  employeeId: string;
  periodKey: string;
  current: PayslipYtdContribution;
}): Promise<PayslipYtdTotals> {
  const year = yearFromPeriodKey(input.periodKey);

  if (year == null) {
    return assemblePayslipYtd({
      year: new Date().getFullYear(),
      priorPosted: [],
      current: input.current,
    });
  }

  const [periodYear, periodMonth] = input.periodKey.split("-").map(Number);
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0, 12));

  const prior = await prisma.payslip.findMany({
    where: {
      employeeId: input.employeeId,
      status: "POSTED",
      payrollPeriod: {
        year,
        periodEnd: { lt: periodEnd },
      },
    },
    select: {
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      snapshot: true,
    },
  });

  return assemblePayslipYtd({
    year,
    priorPosted: prior.map(toContribution),
    current: input.current,
  });
}
