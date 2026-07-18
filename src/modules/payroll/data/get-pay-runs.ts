import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/src/lib/format";
import { evaluateNetPayVariance, type PayVarianceFlag } from "@/src/modules/payroll/lib/pay-variance";
import {
  computePayslipDelta,
  netDeltaDirection,
  formatSignedMoney,
} from "@/src/modules/payroll/lib/payroll-correction-delta";
import { isPayslipIncludedInRun } from "@/src/modules/payroll/lib/pay-run-membership";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";

export {
  getEmployeePostedPayslipHistory,
  getMostRecentPostedPayslip,
  getPayRunBatchPrint,
  getStoredPayslip,
  type EmployeePayslipHistory,
  type PayRunBatchPrintDocument,
  type PayRunBatchPrintResult,
  type SelfServicePayslipHistoryItem,
  type StoredPayslipResult,
} from "@/src/modules/payroll/data/get-stored-payslip";

export type PayRunLifecycleStatusFilter =
  | "DRAFT"
  | "APPROVED"
  | "POSTED"
  | "RECONCILED"
  | "CLOSED";

export type PayRunListItem = {
  id: string;
  runNumber: string;
  status: PayRunLifecycleStatusFilter;
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
  status: PayRunLifecycleStatusFilter;
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
  createdByName: string | null;
  postedByName: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  approvalNote: string | null;
  /** Most recent recalculation of this run (from the audit trail). */
  lastRecalc: { byName: string | null; at: string } | null;
  /** Recent bank / GL export events for this run (most recent first). */
  exports: Array<{
    kind: "BANK" | "GL" | "OTHER";
    label: string;
    byName: string | null;
    at: string;
  }>;
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
  /**
   * Net-pay variance vs the employee's prior posted period (REGULAR
   * draft/approved runs only). Only flags requiring explanation are
   * included — used to drive the Exceptions panel before approval.
   */
  varianceFlags: PayVarianceFlag[];
};

function decimalLabel(value: { toString(): string }, currency: string) {
  return formatMoney(Number(value.toString()), { currency });
}

export async function listPayRuns(options?: {
  /** Actor whose organization scopes the returned runs. Resolves via session/legacy fallback when omitted. */
  actorUserId?: string | null;
  organizationId?: string | null;
}): Promise<PayRunListItem[]> {
  const organizationId =
    options?.organizationId ??
    (await resolvePayrollOrganization({ actorUserId: options?.actorUserId })).id;

  const runs = await prisma.payRun.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      runNumber: true,
      status: true,
      runKind: true,
      currency: true,
      employeeCount: true,
      totalGross: true,
      totalNet: true,
      postedAt: true,
      createdAt: true,
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
  options?: {
    actorUserId?: string | null;
    organizationId?: string | null;
  },
): Promise<PayRunDetail | null> {
  const organizationId =
    options?.organizationId ??
    (await resolvePayrollOrganization({ actorUserId: options?.actorUserId })).id;

  const run = await prisma.payRun.findUnique({
    where: { id: payRunId, organizationId },
    include: {
      payrollPeriod: true,
      sourcePayRun: {
        select: { id: true, runNumber: true },
      },
      payslips: {
        orderBy: [{ employeeName: "asc" }],
        // Snapshot JSON and line-item rows load on payslip detail / editor expand.
        omit: { snapshot: true },
      },
    },
  });

  if (!run) {
    return null;
  }

  const needsLineItems =
    run.status === "DRAFT" || run.status === "APPROVED";

  const payslipIds = run.payslips.map((slip) => slip.id);

  const userIds = [
    ...new Set(
      [
        run.createdById,
        run.postedById,
        run.approvedById,
        ...run.payslips.map((slip) => slip.excludedByUserId),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  const includedEmployeeIds =
    run.runKind === "REGULAR" &&
    (run.status === "DRAFT" || run.status === "APPROVED")
      ? [
          ...new Set(
            run.payslips
              .filter((slip) => isPayslipIncludedInRun(slip.status))
              .map((slip) => slip.employeeId),
          ),
        ]
      : [];

  const [
    users,
    lineItems,
    recalcEvent,
    exportEvents,
    priorNetRows,
  ] = await Promise.all([
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([] as Array<{
          id: string;
          firstName: string;
          lastName: string;
        }>),
    needsLineItems && payslipIds.length > 0
      ? prisma.payrollLineItem.findMany({
          where: { payslipId: { in: payslipIds } },
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            payslipId: true,
            lineType: true,
            code: true,
            label: true,
            amount: true,
            isTaxable: true,
            notes: true,
          },
        })
      : Promise.resolve([] as Array<{
          id: string;
          payslipId: string;
          lineType: "EARNING" | "DEDUCTION";
          code: string;
          label: string;
          amount: { toString(): string };
          isTaxable: boolean;
          notes: string | null;
        }>),
    prisma.auditEvent.findFirst({
      where: {
        moduleKey: "payroll",
        entityType: "PayRun",
        entityId: run.id,
        action: "UPDATE",
        description: { contains: "Recalculated draft pay run" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.auditEvent.findMany({
      where: {
        moduleKey: "payroll",
        entityType: "PayRun",
        entityId: run.id,
        action: "EXPORT",
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        createdAt: true,
        newValues: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    includedEmployeeIds.length > 0
      ? prisma.$queryRaw<Array<{ employeeId: string; netPay: Prisma.Decimal }>>`
          SELECT DISTINCT ON (p."employeeId")
            p."employeeId",
            p."netPay"
          FROM "payroll"."payslips" p
          INNER JOIN "payroll"."payroll_periods" pp ON pp.id = p."payrollPeriodId"
          WHERE p."employeeId" IN (${Prisma.join(includedEmployeeIds)})
            AND p.status = 'POSTED'
            AND pp."periodEnd" < ${run.payrollPeriod.periodEnd}
          ORDER BY p."employeeId", pp."periodEnd" DESC
        `
      : Promise.resolve([] as Array<{ employeeId: string; netPay: Prisma.Decimal }>),
  ]);

  const lineItemsByPayslip = new Map<string, typeof lineItems>();
  for (const line of lineItems) {
    const list = lineItemsByPayslip.get(line.payslipId) ?? [];
    list.push(line);
    lineItemsByPayslip.set(line.payslipId, list);
  }

  const userNameById = new Map(
    users.map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`.trim(),
    ]),
  );
  const excluderNameById = userNameById;

  const userDisplay = (
    user: { firstName: string; lastName: string } | null,
  ): string | null => (user ? `${user.firstName} ${user.lastName}`.trim() : null);

  const lastRecalc = recalcEvent
    ? { byName: userDisplay(recalcEvent.user), at: recalcEvent.createdAt.toISOString() }
    : null;

  const exports = exportEvents.map((event) => {
    const kindRaw =
      event.newValues &&
      typeof event.newValues === "object" &&
      !Array.isArray(event.newValues)
        ? (event.newValues as Record<string, unknown>).exportKind
        : null;
    const kind =
      kindRaw === "BANK" ? "BANK" : kindRaw === "GL" ? "GL" : "OTHER";
    const label =
      kind === "BANK"
        ? "Bank payment CSV"
        : kind === "GL"
          ? "GL journal CSV"
          : "Export";
    return {
      kind: kind as "BANK" | "GL" | "OTHER",
      label,
      byName: userDisplay(event.user),
      at: event.createdAt.toISOString(),
    };
  });

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

  // Net-pay variance vs the prior posted period — REGULAR draft/approved runs
  // only. Corrections/off-cycle already have their own original-vs-correction
  // comparison above and are not compared period-over-period here.
  const varianceFlags: PayVarianceFlag[] = [];

  if (
    run.runKind === "REGULAR" &&
    (run.status === "DRAFT" || run.status === "APPROVED")
  ) {
    const priorNetByEmployee = new Map(
      priorNetRows.map((row) => [
        row.employeeId,
        Number(row.netPay.toString()),
      ]),
    );

    for (const slip of run.payslips.filter((row) =>
      isPayslipIncludedInRun(row.status),
    )) {
      const flag = evaluateNetPayVariance({
        employeeId: slip.employeeId,
        employeeName: slip.employeeName,
        priorNet: priorNetByEmployee.get(slip.employeeId) ?? null,
        currentNet: Number(slip.netPay.toString()),
      });

      if (flag.requiresExplanation) {
        varianceFlags.push(flag);
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
    createdByName: run.createdById
      ? (userNameById.get(run.createdById) ?? null)
      : null,
    postedByName: run.postedById
      ? (userNameById.get(run.postedById) ?? null)
      : null,
    varianceFlags,
    approvedAt: run.approvedAt?.toISOString() ?? null,
    approvedByName: run.approvedById
      ? (userNameById.get(run.approvedById) ?? null)
      : null,
    approvalNote: run.approvalNote,
    lastRecalc,
    exports,
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
        lineItems: (lineItemsByPayslip.get(slip.id) ?? []).map((line) => ({
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
