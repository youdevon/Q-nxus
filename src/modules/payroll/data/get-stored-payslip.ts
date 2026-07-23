import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/src/lib/format";
import {
  getPayslipYtdBreakdown,
  getPayslipYtdBreakdownBatch,
  getPostedPayslipYtd,
  getPostedPayslipYtdBatch,
  payslipPreviewToYtdContribution,
} from "@/src/modules/payroll/data/get-payslip-ytd";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { isPayslipIncludedInRun } from "@/src/modules/payroll/lib/pay-run-membership";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import type {
  PayslipYtdBreakdown,
  PayslipYtdTotals,
} from "@/src/modules/payroll/lib/payslip-ytd";
import type { ProjectedTaxYearPosition } from "@/src/modules/payroll/lib/projected-tax-year-position";
import { getApprovedProjectedTaxYearPosition } from "@/src/modules/payroll/data/get-annual-paye-projections";

function decimalLabel(value: { toString(): string }, currency: string) {
  return formatMoney(Number(value.toString()), { currency });
}

export type StoredPayslipResult = {
  id: string;
  payRunId: string;
  runNumber: string;
  periodName: string;
  periodKey: string;
  status: "DRAFT" | "EXCLUDED" | "POSTED";
  isPosted: boolean;
  /** True once payroll has released the slip for employee self-service. */
  isReleased: boolean;
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd: PayslipYtdTotals | null;
  ytdBreakdown: PayslipYtdBreakdown | null;
  projectedTaxYearPosition: ProjectedTaxYearPosition | null;
};

export type PayRunBatchPrintDocument = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd: PayslipYtdTotals | null;
  ytdBreakdown: PayslipYtdBreakdown | null;
  projectedTaxYearPosition: ProjectedTaxYearPosition | null;
  isOfficial: boolean;
};

export type PayRunBatchPrintResult = {
  id: string;
  runNumber: string;
  periodName: string;
  periodKey: string;
  documents: PayRunBatchPrintDocument[];
};

export async function getStoredPayslip(
  payslipId: string,
): Promise<StoredPayslipResult | null> {
  const row = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      payRun: {
        select: {
          id: true,
          runNumber: true,
          status: true,
          postedAt: true,
        },
      },
      payrollPeriod: {
        select: {
          name: true,
          periodKey: true,
          year: true,
          periodEnd: true,
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  const snapshot = parsePayslipSnapshot(row.snapshot);

  if (!snapshot) {
    return null;
  }

  const isPosted = row.status === "POSTED";
  const isReleased = isPosted && row.releasedAt != null;
  const ytd = isPosted
    ? await getPostedPayslipYtd({
        employeeId: row.employeeId,
        payslipId: row.id,
        year: row.payrollPeriod.year,
        periodEnd: row.payrollPeriod.periodEnd,
        postedAt: row.payRun.postedAt,
        createdAt: row.createdAt,
        current: payslipPreviewToYtdContribution(snapshot.payslip),
      })
    : null;
  const ytdBreakdown =
    ytd != null
      ? await getPayslipYtdBreakdown(row.employeeId, ytd)
      : null;
  const projectedTaxYearPosition = await getApprovedProjectedTaxYearPosition(
    row.employeeId,
    row.payrollPeriod.year,
  );

  return {
    id: row.id,
    payRunId: row.payRun.id,
    runNumber: row.payRun.runNumber,
    periodName: row.payrollPeriod.name,
    periodKey: row.payrollPeriod.periodKey,
    status: row.status,
    isPosted,
    isReleased,
    payslip: snapshot.payslip,
    meta: snapshot.meta,
    ytd,
    ytdBreakdown,
    projectedTaxYearPosition,
  };
}

/** Included (non-excluded) payslips for a posted run — multi-document print. */
export async function getPayRunBatchPrint(
  payRunId: string,
): Promise<PayRunBatchPrintResult | null> {
  const run = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payrollPeriod: {
        select: {
          name: true,
          periodKey: true,
          year: true,
          periodEnd: true,
        },
      },
      payslips: {
        where: {
          status: { not: "EXCLUDED" },
        },
        orderBy: [{ employeeName: "asc" }],
      },
    },
  });

  if (!run || !isPayRunPosted(run.status)) {
    return null;
  }

  const printable = run.payslips.filter(
    (slip) =>
      isPayslipIncludedInRun(slip.status) && parsePayslipSnapshot(slip.snapshot),
  );

  const ytdInputs = printable
    .filter((slip) => slip.status === "POSTED")
    .map((slip) => {
      const snapshot = parsePayslipSnapshot(slip.snapshot)!;
      return {
        employeeId: slip.employeeId,
        payslipId: slip.id,
        year: run.payrollPeriod.year,
        periodEnd: run.payrollPeriod.periodEnd,
        postedAt: run.postedAt,
        createdAt: slip.createdAt,
        current: payslipPreviewToYtdContribution(snapshot.payslip),
      };
    });

  const ytdByPayslipId = await getPostedPayslipYtdBatch(ytdInputs);
  const breakdownByPayslipId = await getPayslipYtdBreakdownBatch(
    ytdInputs
      .map((input) => {
        const ytd = ytdByPayslipId.get(input.payslipId);
        if (!ytd) {
          return null;
        }
        return {
          key: input.payslipId,
          employeeId: input.employeeId,
          currentEmployer: ytd,
        };
      })
      .filter(
        (row): row is {
          key: string;
          employeeId: string;
          currentEmployer: PayslipYtdTotals;
        } => row != null,
      ),
  );

  const documents: PayRunBatchPrintDocument[] = await Promise.all(
    printable.map(async (slip) => {
      const snapshot = parsePayslipSnapshot(slip.snapshot)!;
      const projectedTaxYearPosition =
        await getApprovedProjectedTaxYearPosition(
          slip.employeeId,
          run.payrollPeriod.year,
        );
      return {
        id: slip.id,
        employeeId: slip.employeeId,
        employeeName: slip.employeeName,
        employeeNumber: slip.employeeNumber,
        payslip: snapshot.payslip,
        meta: snapshot.meta,
        ytd: ytdByPayslipId.get(slip.id) ?? null,
        ytdBreakdown: breakdownByPayslipId.get(slip.id) ?? null,
        projectedTaxYearPosition,
        isOfficial: slip.status === "POSTED",
      };
    }),
  );

  return {
    id: run.id,
    runNumber: run.runNumber,
    periodName: run.payrollPeriod.name,
    periodKey: run.payrollPeriod.periodKey,
    documents,
  };
}

export type SelfServicePayslipHistoryItem = {
  id: string;
  periodName: string;
  periodKey: string;
  year: number;
  runNumber: string;
  runKind: "REGULAR" | "CORRECTION" | "OFF_CYCLE";
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  postedAt: string | null;
  viewHref: string;
  printHref: string;
};

export type EmployeePayslipHistory = {
  /** Distinct years that have posted payslips, most recent first. */
  years: number[];
  /** Selected year, or null when showing the last 12 months. */
  selectedYear: number | null;
  items: SelfServicePayslipHistoryItem[];
};

/**
 * Posted payslip history for one employee (self-service, own record only).
 * Defaults to the last 12 months; pass a year to filter to that calendar year.
 */
export async function getEmployeePostedPayslipHistory(
  employeeId: string,
  options?: { year?: number | null },
): Promise<EmployeePayslipHistory> {
  const slips = await prisma.payslip.findMany({
    where: {
      employeeId,
      status: "POSTED",
      releasedAt: { not: null },
    },
    orderBy: [
      { payrollPeriod: { periodEnd: "desc" } },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      currency: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      payRun: {
        select: { runNumber: true, runKind: true, postedAt: true },
      },
      payrollPeriod: {
        select: { name: true, periodKey: true, year: true, periodEnd: true },
      },
    },
  });

  const years = [
    ...new Set(slips.map((slip) => slip.payrollPeriod.year)),
  ].sort((a, b) => b - a);

  const requestedYear =
    options?.year != null && years.includes(options.year)
      ? options.year
      : null;

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const filtered = slips.filter((slip) => {
    if (requestedYear != null) {
      return slip.payrollPeriod.year === requestedYear;
    }
    return slip.payrollPeriod.periodEnd.getTime() >= twelveMonthsAgo.getTime();
  });

  return {
    years,
    selectedYear: requestedYear,
    items: filtered.map((slip) => ({
      id: slip.id,
      periodName: slip.payrollPeriod.name,
      periodKey: slip.payrollPeriod.periodKey,
      year: slip.payrollPeriod.year,
      runNumber: slip.payRun.runNumber,
      runKind: slip.payRun.runKind,
      grossPay: decimalLabel(slip.grossPay, slip.currency),
      totalDeductions: decimalLabel(slip.totalDeductions, slip.currency),
      netPay: decimalLabel(slip.netPay, slip.currency),
      postedAt: slip.payRun.postedAt?.toISOString() ?? null,
      viewHref: `/me/payslip?payslipId=${slip.id}`,
      printHref: `/me/payslip/print?payslipId=${slip.id}`,
    })),
  };
}

/** Most recent posted payslip for an employee (official history). */
export async function getMostRecentPostedPayslip(
  employeeId: string,
): Promise<StoredPayslipResult | null> {
  const row = await prisma.payslip.findFirst({
    where: {
      employeeId,
      status: "POSTED",
      releasedAt: { not: null },
    },
    orderBy: [
      { payrollPeriod: { periodEnd: "desc" } },
      { createdAt: "desc" },
    ],
    include: {
      payRun: {
        select: {
          id: true,
          runNumber: true,
          status: true,
          postedAt: true,
        },
      },
      payrollPeriod: {
        select: {
          name: true,
          periodKey: true,
          year: true,
          periodEnd: true,
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  const snapshot = parsePayslipSnapshot(row.snapshot);

  if (!snapshot) {
    return null;
  }

  const ytd = await getPostedPayslipYtd({
    employeeId: row.employeeId,
    payslipId: row.id,
    year: row.payrollPeriod.year,
    periodEnd: row.payrollPeriod.periodEnd,
    postedAt: row.payRun.postedAt,
    createdAt: row.createdAt,
    current: payslipPreviewToYtdContribution(snapshot.payslip),
  });
  const ytdBreakdown = await getPayslipYtdBreakdown(row.employeeId, ytd);
  const projectedTaxYearPosition = await getApprovedProjectedTaxYearPosition(
    row.employeeId,
    row.payrollPeriod.year,
  );

  return {
    id: row.id,
    payRunId: row.payRun.id,
    runNumber: row.payRun.runNumber,
    periodName: row.payrollPeriod.name,
    periodKey: row.payrollPeriod.periodKey,
    status: row.status,
    isPosted: true,
    isReleased: true,
    payslip: snapshot.payslip,
    meta: snapshot.meta,
    ytd,
    ytdBreakdown,
    projectedTaxYearPosition,
  };
}
