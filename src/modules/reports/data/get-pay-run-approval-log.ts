import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/src/lib/format";
import type { PayRunKindAnalytics } from "@/src/modules/payroll/lib/payroll-analytics";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";

export type PayRunApprovalLogRow = {
  id: string;
  runNumber: string;
  runKind: PayRunKindAnalytics;
  status: string;
  periodKey: string;
  periodName: string;
  employeeCount: number;
  totalGrossLabel: string;
  totalNetLabel: string;
  approvedAt: string | null;
  approvedByName: string | null;
  postedAt: string | null;
  postedByName: string | null;
};

export type PayRunApprovalLogReport = {
  dateFrom: string;
  dateTo: string;
  rows: PayRunApprovalLogRow[];
};

function parseDateParam(value: string | undefined, fallback: Date): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return fallback.toISOString().slice(0, 10);
}

function moneyLabel(value: { toString(): string }, currency: string): string {
  return formatMoney(Number(value.toString()), { currency });
}

/** Pay runs approved or posted within the selected date range. */
export async function getPayRunApprovalLogReport(input?: {
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: string | null;
}): Promise<PayRunApprovalLogReport> {
  const organizationId = (
    await resolvePayrollOrganization({ actorUserId: input?.actorUserId })
  ).id;

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultTo = now;

  const dateFrom = parseDateParam(input?.dateFrom, defaultFrom);
  const dateTo = parseDateParam(input?.dateTo, defaultTo);

  const rangeStart = new Date(`${dateFrom}T00:00:00.000Z`);
  const rangeEnd = new Date(`${dateTo}T23:59:59.999Z`);

  const runs = await prisma.payRun.findMany({
    where: {
      organizationId,
      OR: [
        { approvedAt: { gte: rangeStart, lte: rangeEnd } },
        { postedAt: { gte: rangeStart, lte: rangeEnd } },
      ],
    },
    orderBy: [{ postedAt: "desc" }, { approvedAt: "desc" }],
    select: {
      id: true,
      runNumber: true,
      runKind: true,
      status: true,
      currency: true,
      employeeCount: true,
      totalGross: true,
      totalNet: true,
      approvedAt: true,
      approvedById: true,
      postedAt: true,
      postedById: true,
      payrollPeriod: {
        select: { periodKey: true, name: true },
      },
    },
  });

  const userIds = [
    ...new Set(
      runs.flatMap((run) =>
        [run.approvedById, run.postedById].filter(
          (id): id is string => id != null,
        ),
      ),
    ),
  ];

  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

  const userNameById = new Map(
    users.map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`.trim(),
    ]),
  );

  return {
    dateFrom,
    dateTo,
    rows: runs.map((run) => ({
      id: run.id,
      runNumber: run.runNumber,
      runKind: run.runKind,
      status: run.status,
      periodKey: run.payrollPeriod.periodKey,
      periodName: run.payrollPeriod.name,
      employeeCount: run.employeeCount,
      totalGrossLabel: moneyLabel(run.totalGross, run.currency),
      totalNetLabel: moneyLabel(run.totalNet, run.currency),
      approvedAt: run.approvedAt?.toISOString() ?? null,
      approvedByName: run.approvedById
        ? (userNameById.get(run.approvedById) ?? null)
        : null,
      postedAt: run.postedAt?.toISOString() ?? null,
      postedByName: run.postedById
        ? (userNameById.get(run.postedById) ?? null)
        : null,
    })),
  };
}
