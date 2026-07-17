import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/src/lib/format";
import {
  getPostedPayslipYtd,
  payslipPreviewToYtdContribution,
} from "@/src/modules/payroll/data/get-payslip-ytd";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import {
  computePayslipDelta,
  netDeltaDirection,
  formatSignedMoney,
} from "@/src/modules/payroll/lib/payroll-correction-delta";
import { isPayslipIncludedInRun } from "@/src/modules/payroll/lib/pay-run-membership";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import type { PayslipYtdTotals } from "@/src/modules/payroll/lib/payslip-ytd";

export type PayRunListItem = {
  id: string;
  runNumber: string;
  status: "DRAFT" | "POSTED";
  runKind: "REGULAR" | "CORRECTION" | "OFF_CYCLE";
  currency: string;
  employeeCount: number;
  totalGross: string;
  totalNet: string;
  postedAt: string | null;
  createdAt: string;
  period: {
    id: string;
    name: string;
    periodKey: string;
    status: "OPEN" | "CLOSED";
    frequency: string;
  };
};

export type PayRunPayslipRow = {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  jobTitle: string | null;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  status: "DRAFT" | "EXCLUDED" | "POSTED";
  isExcluded: boolean;
  exclusionReason: string | null;
  excludedAt: string | null;
  excludedByName: string | null;
  lineItems: Array<{
    id: string;
    lineType: "EARNING" | "DEDUCTION";
    code: string;
    label: string;
    amount: string;
    isTaxable: boolean;
    notes: string | null;
  }>;
  /**
   * Original-vs-correction comparison for correction / off-cycle runs.
   * null on regular runs or when no comparable posted slip exists.
   */
  comparison: {
    sourceLabel: string;
    original: { grossPay: string; totalDeductions: string; netPay: string };
    correction: { grossPay: string; totalDeductions: string; netPay: string };
    delta: { grossPay: string; totalDeductions: string; netPay: string };
    netDirection: "increase" | "decrease" | "none";
  } | null;
  viewHref: string;
  printHref: string;
};

export type PayRunDetail = {
  id: string;
  runNumber: string;
  status: "DRAFT" | "POSTED";
  runKind: "REGULAR" | "CORRECTION" | "OFF_CYCLE";
  sourcePayRunId: string | null;
  sourceRunNumber: string | null;
  currency: string;
  employeeCount: number;
  excludedCount: number;
  totalGross: string;
  totalDeductions: string;
  totalNet: string;
  notes: string | null;
  postedAt: string | null;
  createdAt: string;
  period: {
    id: string;
    name: string;
    periodKey: string;
    status: "OPEN" | "CLOSED";
    frequency: string;
    periodStart: string;
    periodEnd: string;
  };
  payslips: PayRunPayslipRow[];
};

function decimalLabel(value: { toString(): string }, currency: string) {
  return formatMoney(Number(value.toString()), { currency });
}

export async function listPayRuns(): Promise<PayRunListItem[]> {
  const runs = await prisma.payRun.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      payrollPeriod: {
        select: {
          id: true,
          name: true,
          periodKey: true,
          status: true,
          frequency: true,
        },
      },
    },
  });

  return runs.map((run) => ({
    id: run.id,
    runNumber: run.runNumber,
    status: run.status,
    runKind: run.runKind,
    currency: run.currency,
    employeeCount: run.employeeCount,
    totalGross: decimalLabel(run.totalGross, run.currency),
    totalNet: decimalLabel(run.totalNet, run.currency),
    postedAt: run.postedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    period: {
      id: run.payrollPeriod.id,
      name: run.payrollPeriod.name,
      periodKey: run.payrollPeriod.periodKey,
      status: run.payrollPeriod.status,
      frequency: run.payrollPeriod.frequency,
    },
  }));
}

export async function getPayRunDetail(
  payRunId: string,
): Promise<PayRunDetail | null> {
  const run = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payrollPeriod: true,
      sourcePayRun: {
        select: { id: true, runNumber: true },
      },
      payslips: {
        orderBy: [{ employeeName: "asc" }],
        include: {
          lineItems: {
            orderBy: [{ createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!run) {
    return null;
  }

  const excluderIds = [
    ...new Set(
      run.payslips
        .map((slip) => slip.excludedByUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const excluders =
    excluderIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: excluderIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

  const excluderNameById = new Map(
    excluders.map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`.trim(),
    ]),
  );

  const excludedCount = run.payslips.filter(
    (slip) => !isPayslipIncludedInRun(slip.status),
  ).length;

  // Correction / off-cycle runs compare each slip to the original posted slip:
  // the linked source run when present, otherwise the most recent posted slip
  // for that employee in the same period (excluding this run).
  type OriginalAmounts = {
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    sourceLabel: string;
  };
  const originalByEmployee = new Map<string, OriginalAmounts>();

  if (run.runKind !== "REGULAR") {
    if (run.sourcePayRunId) {
      const sourceSlips = await prisma.payslip.findMany({
        where: { payRunId: run.sourcePayRunId, status: "POSTED" },
        select: {
          employeeId: true,
          grossPay: true,
          totalDeductions: true,
          netPay: true,
        },
      });
      const sourceLabel = run.sourcePayRun?.runNumber ?? "source run";
      for (const slip of sourceSlips) {
        originalByEmployee.set(slip.employeeId, {
          grossPay: Number(slip.grossPay.toString()),
          totalDeductions: Number(slip.totalDeductions.toString()),
          netPay: Number(slip.netPay.toString()),
          sourceLabel,
        });
      }
    } else {
      const priorSlips = await prisma.payslip.findMany({
        where: {
          payrollPeriodId: run.payrollPeriodId,
          status: "POSTED",
          payRunId: { not: run.id },
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          employeeId: true,
          grossPay: true,
          totalDeductions: true,
          netPay: true,
          payRun: { select: { runNumber: true } },
        },
      });
      for (const slip of priorSlips) {
        if (originalByEmployee.has(slip.employeeId)) {
          continue;
        }
        originalByEmployee.set(slip.employeeId, {
          grossPay: Number(slip.grossPay.toString()),
          totalDeductions: Number(slip.totalDeductions.toString()),
          netPay: Number(slip.netPay.toString()),
          sourceLabel: slip.payRun.runNumber,
        });
      }
    }
  }

  return {
    id: run.id,
    runNumber: run.runNumber,
    status: run.status,
    runKind: run.runKind,
    sourcePayRunId: run.sourcePayRunId,
    sourceRunNumber: run.sourcePayRun?.runNumber ?? null,
    currency: run.currency,
    employeeCount: run.employeeCount,
    excludedCount,
    totalGross: decimalLabel(run.totalGross, run.currency),
    totalDeductions: decimalLabel(run.totalDeductions, run.currency),
    totalNet: decimalLabel(run.totalNet, run.currency),
    notes: run.notes,
    postedAt: run.postedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    period: {
      id: run.payrollPeriod.id,
      name: run.payrollPeriod.name,
      periodKey: run.payrollPeriod.periodKey,
      status: run.payrollPeriod.status,
      frequency: run.payrollPeriod.frequency,
      periodStart: run.payrollPeriod.periodStart.toISOString().slice(0, 10),
      periodEnd: run.payrollPeriod.periodEnd.toISOString().slice(0, 10),
    },
    payslips: run.payslips.map((slip) => {
      const isExcluded = !isPayslipIncludedInRun(slip.status);
      const original = originalByEmployee.get(slip.employeeId) ?? null;
      const correctionAmounts = {
        grossPay: Number(slip.grossPay.toString()),
        totalDeductions: Number(slip.totalDeductions.toString()),
        netPay: Number(slip.netPay.toString()),
      };
      const delta =
        run.runKind !== "REGULAR"
          ? computePayslipDelta(correctionAmounts, original)
          : null;
      const comparison =
        run.runKind !== "REGULAR" && original && delta
          ? {
              sourceLabel: original.sourceLabel,
              original: {
                grossPay: decimalLabel(original.grossPay, slip.currency),
                totalDeductions: decimalLabel(
                  original.totalDeductions,
                  slip.currency,
                ),
                netPay: decimalLabel(original.netPay, slip.currency),
              },
              correction: {
                grossPay: decimalLabel(correctionAmounts.grossPay, slip.currency),
                totalDeductions: decimalLabel(
                  correctionAmounts.totalDeductions,
                  slip.currency,
                ),
                netPay: decimalLabel(correctionAmounts.netPay, slip.currency),
              },
              delta: {
                grossPay: formatSignedMoney(delta.grossPay, {
                  currency: slip.currency,
                }),
                totalDeductions: formatSignedMoney(delta.totalDeductions, {
                  currency: slip.currency,
                }),
                netPay: formatSignedMoney(delta.netPay, {
                  currency: slip.currency,
                }),
              },
              netDirection: netDeltaDirection(delta),
            }
          : null;

      return {
        id: slip.id,
        employeeId: slip.employeeId,
        employeeNumber: slip.employeeNumber,
        employeeName: slip.employeeName,
        departmentName: slip.departmentName,
        jobTitle: slip.jobTitle,
        grossPay: decimalLabel(slip.grossPay, slip.currency),
        totalDeductions: decimalLabel(slip.totalDeductions, slip.currency),
        netPay: decimalLabel(slip.netPay, slip.currency),
        status: slip.status,
        isExcluded,
        exclusionReason: slip.exclusionReason,
        excludedAt: slip.excludedAt?.toISOString() ?? null,
        excludedByName: slip.excludedByUserId
          ? (excluderNameById.get(slip.excludedByUserId) ?? null)
          : null,
        lineItems: slip.lineItems.map((line) => ({
          id: line.id,
          lineType: line.lineType,
          code: line.code,
          label: line.label,
          amount: decimalLabel(line.amount, slip.currency),
          isTaxable: line.isTaxable,
          notes: line.notes,
        })),
        comparison,
        viewHref: `/payroll/runs/${run.id}/payslips/${slip.id}`,
        printHref: `/payroll/runs/${run.id}/payslips/${slip.id}/print`,
      };
    }),
  };
}

export type StoredPayslipResult = {
  id: string;
  payRunId: string;
  runNumber: string;
  periodName: string;
  periodKey: string;
  status: "DRAFT" | "EXCLUDED" | "POSTED";
  isPosted: boolean;
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd: PayslipYtdTotals | null;
};

export type PayRunBatchPrintDocument = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd: PayslipYtdTotals | null;
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

  return {
    id: row.id,
    payRunId: row.payRun.id,
    runNumber: row.payRun.runNumber,
    periodName: row.payrollPeriod.name,
    periodKey: row.payrollPeriod.periodKey,
    status: row.status,
    isPosted,
    payslip: snapshot.payslip,
    meta: snapshot.meta,
    ytd,
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

  if (!run || run.status !== "POSTED") {
    return null;
  }

  const documents: PayRunBatchPrintDocument[] = [];

  for (const slip of run.payslips) {
    if (!isPayslipIncludedInRun(slip.status)) {
      continue;
    }

    const snapshot = parsePayslipSnapshot(slip.snapshot);

    if (!snapshot) {
      continue;
    }

    const ytd =
      slip.status === "POSTED"
        ? await getPostedPayslipYtd({
            employeeId: slip.employeeId,
            payslipId: slip.id,
            year: run.payrollPeriod.year,
            periodEnd: run.payrollPeriod.periodEnd,
            postedAt: run.postedAt,
            createdAt: slip.createdAt,
            current: payslipPreviewToYtdContribution(snapshot.payslip),
          })
        : null;

    documents.push({
      id: slip.id,
      employeeId: slip.employeeId,
      employeeName: slip.employeeName,
      employeeNumber: slip.employeeNumber,
      payslip: snapshot.payslip,
      meta: snapshot.meta,
      ytd,
      isOfficial: slip.status === "POSTED",
    });
  }

  return {
    id: run.id,
    runNumber: run.runNumber,
    periodName: run.payrollPeriod.name,
    periodKey: run.payrollPeriod.periodKey,
    documents,
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

  return {
    id: row.id,
    payRunId: row.payRun.id,
    runNumber: row.payRun.runNumber,
    periodName: row.payrollPeriod.name,
    periodKey: row.payrollPeriod.periodKey,
    status: row.status,
    isPosted: true,
    payslip: snapshot.payslip,
    meta: snapshot.meta,
    ytd,
  };
}
