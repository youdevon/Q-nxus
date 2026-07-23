import { LeaveRequestStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isLeavePeriodStarted,
  splitLeaveTakenForDisplay,
} from "@/src/modules/hr/lib/leave-balance-math";

export const LEAVE_BALANCE_EMPLOYEE_SEARCH_LIMIT = 12;

export type ContractLeaveBalanceRecord = {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  contractId: string;
  contractNumber: string | null;
  /** Always true here — query is scoped to the current employment contract. */
  contractIsCurrent: boolean;
  cycleStart: string;
  cycleEnd: string;
  /**
   * Today falls within this balance’s cycle window
   * (inclusive of cycle start/end calendar days).
   */
  isCurrentCycle: boolean;
  leaveTypeCode: string;
  leaveTypeName: string;
  entitlement: string;
  accrued: string;
  carriedForward: string;
  adjustments: string;
  reserved: string;
  /** Approved leave that has not started yet (still in ledger `taken`). */
  approved: string;
  /** Approved leave that has started or completed. */
  taken: string;
  expired: string;
  openingBalance: string;
  availableBalance: string;
};

export type LeaveBalanceEmployeeMatch = {
  id: string;
  employeeNumber: string;
  name: string;
  workEmail: string | null;
  departmentName: string | null;
  /** Current-contract leave snapshot for search results / deep links. */
  leaveSummary: {
    vacationAvailable: string;
    sickAvailable: string;
    totalAvailable: string;
    totalTaken: string;
    totalApproved: string;
    leaveTypeCount: number;
  } | null;
};

export type GetContractLeaveBalancesOptions = {
  employeeId: string;
};

function employeeTokenWhere(token: string): Prisma.EmployeeWhereInput {
  return {
    OR: [
      { employeeNumber: { contains: token, mode: "insensitive" } },
      { firstName: { contains: token, mode: "insensitive" } },
      { middleName: { contains: token, mode: "insensitive" } },
      { lastName: { contains: token, mode: "insensitive" } },
      { preferredName: { contains: token, mode: "insensitive" } },
      { workEmail: { contains: token, mode: "insensitive" } },
      { personalEmail: { contains: token, mode: "insensitive" } },
    ],
  };
}

function employeeSearchWhere(
  organizationId: string,
  query: string,
): Prisma.EmployeeWhereInput {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      organizationId,
      isArchived: false,
    };
  }

  // Every token must match some identity field so "Jane Doe" finds Jane Doe.
  return {
    organizationId,
    isArchived: false,
    AND: tokens.map((token) => employeeTokenWhere(token)),
  };
}

function mapEmployeeMatch(employee: {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  workEmail: string | null;
  department: { name: string } | null;
}): LeaveBalanceEmployeeMatch {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    name: `${employee.preferredName ?? employee.firstName} ${employee.lastName}`.trim(),
    workEmail: employee.workEmail,
    departmentName: employee.department?.name ?? null,
    leaveSummary: null,
  };
}

function emptyLeaveSummary(): LeaveBalanceEmployeeMatch["leaveSummary"] {
  return {
    vacationAvailable: "0",
    sickAvailable: "0",
    totalAvailable: "0",
    totalTaken: "0",
    totalApproved: "0",
    leaveTypeCount: 0,
  };
}

async function attachLeaveSummaries(
  matches: LeaveBalanceEmployeeMatch[],
): Promise<LeaveBalanceEmployeeMatch[]> {
  if (matches.length === 0) {
    return matches;
  }

  const employeeIds = matches.map((match) => match.id);
  const balances = await prisma.employeeLeaveBalance.findMany({
    where: {
      employeeId: { in: employeeIds },
      contract: { isCurrent: true },
    },
    select: {
      employeeId: true,
      availableBalance: true,
      taken: true,
      reserved: true,
      leaveType: { select: { code: true } },
    },
  });

  const summaryByEmployee = new Map<
    string,
    NonNullable<LeaveBalanceEmployeeMatch["leaveSummary"]>
  >();

  for (const employeeId of employeeIds) {
    summaryByEmployee.set(employeeId, emptyLeaveSummary()!);
  }

  for (const balance of balances) {
    const summary = summaryByEmployee.get(balance.employeeId);
    if (!summary) continue;

    const available = Number(balance.availableBalance);
    const taken = Number(balance.taken);
    const reserved = Number(balance.reserved);
    summary.leaveTypeCount += 1;
    summary.totalAvailable = String(Number(summary.totalAvailable) + available);
    summary.totalTaken = String(Number(summary.totalTaken) + taken);
    summary.totalApproved = String(Number(summary.totalApproved) + reserved);

    if (balance.leaveType.code === "VAC") {
      summary.vacationAvailable = String(
        Number(summary.vacationAvailable) + available,
      );
    }
    if (balance.leaveType.code === "SICK") {
      summary.sickAvailable = String(Number(summary.sickAvailable) + available);
    }
  }

  for (const summary of summaryByEmployee.values()) {
    for (const key of [
      "vacationAvailable",
      "sickAvailable",
      "totalAvailable",
      "totalTaken",
      "totalApproved",
    ] as const) {
      const value = Number(summary[key]);
      summary[key] = Number.isFinite(value) ? String(value) : "0";
    }
  }

  return matches.map((match) => ({
    ...match,
    leaveSummary: summaryByEmployee.get(match.id) ?? emptyLeaveSummary(),
  }));
}

export async function searchEmployeesForLeaveBalances(
  query: string,
): Promise<LeaveBalanceEmployeeMatch[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return [];
  }

  const employees = await prisma.employee.findMany({
    where: employeeSearchWhere(organization.id, trimmed),
    orderBy: [
      {
        lastName: "asc",
      },
      {
        firstName: "asc",
      },
    ],
    take: LEAVE_BALANCE_EMPLOYEE_SEARCH_LIMIT,
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      workEmail: true,
      department: {
        select: {
          name: true,
        },
      },
    },
  });

  return attachLeaveSummaries(employees.map(mapEmployeeMatch));
}

export async function getLeaveBalanceEmployee(
  employeeId: string,
  options?: { includeLeaveSummary?: boolean },
): Promise<LeaveBalanceEmployeeMatch | null> {
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
      preferredName: true,
      workEmail: true,
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

  const match = mapEmployeeMatch(employee);
  if (options?.includeLeaveSummary === false) {
    return match;
  }

  const [withSummary] = await attachLeaveSummaries([match]);
  return withSummary ?? match;
}

export type CurrentContractLeaveEntitlementData = {
  employeeId: string;
  contractId: string;
  contractNumber: string | null;
  vacationLeaveDaysOverride: string | null;
  sickLeaveDaysOverride: string | null;
};

export async function getCurrentContractLeaveEntitlementData(
  employeeId: string,
): Promise<CurrentContractLeaveEntitlementData | null> {
  const contract = await prisma.employmentContract.findFirst({
    where: {
      employeeId,
      isCurrent: true,
      status: "ACTIVE",
      endDate: { not: null },
    },
    select: {
      id: true,
      contractNumber: true,
      vacationLeaveDaysOverride: true,
      sickLeaveDaysOverride: true,
    },
    orderBy: {
      startDate: "desc",
    },
  });

  if (!contract) {
    return null;
  }

  return {
    employeeId,
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    vacationLeaveDaysOverride:
      contract.vacationLeaveDaysOverride?.toString() ?? null,
    sickLeaveDaysOverride: contract.sickLeaveDaysOverride?.toString() ?? null,
  };
}

function contractLeaveTypeKey(contractId: string, leaveTypeId: string): string {
  return `${contractId}:${leaveTypeId}`;
}

function utcCalendarDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function isDateWithinCycle(
  asOf: Date,
  cycleStart: Date,
  cycleEnd: Date,
): boolean {
  const day = utcCalendarDay(asOf).getTime();
  const start = utcCalendarDay(cycleStart).getTime();
  const end = utcCalendarDay(cycleEnd).getTime();

  return day >= start && day <= end;
}

export async function getContractLeaveBalances(
  options: GetContractLeaveBalancesOptions,
): Promise<ContractLeaveBalanceRecord[]> {
  const asOf = new Date();

  // Only the current employment contract drives leave balance display.
  // Amended / renewed predecessors are marked `isCurrent: false` + SUPERSEDED
  // and retain historical balance rows in the DB — hide those from this UI.
  const [balances, approvedRequests] = await Promise.all([
    prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId: options.employeeId,
        contract: {
          isCurrent: true,
        },
      },
      orderBy: [
        {
          cycleStart: "desc",
        },
        {
          leaveType: {
            sortOrder: "asc",
          },
        },
      ],
      select: {
        id: true,
        employeeId: true,
        contractId: true,
        leaveTypeId: true,
        cycleStart: true,
        cycleEnd: true,
        openingBalance: true,
        entitlement: true,
        accrued: true,
        carriedForward: true,
        adjustments: true,
        reserved: true,
        taken: true,
        expired: true,
        availableBalance: true,
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        contract: {
          select: {
            contractNumber: true,
            isCurrent: true,
          },
        },
        leaveType: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: options.employeeId,
        status: LeaveRequestStatus.APPROVED,
        contract: {
          isCurrent: true,
        },
      },
      select: {
        leaveBalanceId: true,
        contractId: true,
        leaveTypeId: true,
        startDate: true,
        requestedQuantity: true,
      },
    }),
  ]);

  const approvedNotYetStartedByBalanceId = new Map<string, number>();
  const approvedNotYetStartedByContractLeaveType = new Map<string, number>();

  for (const request of approvedRequests) {
    if (isLeavePeriodStarted(request.startDate, asOf)) {
      continue;
    }

    const quantity = Number(request.requestedQuantity.toString());

    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    if (request.leaveBalanceId) {
      approvedNotYetStartedByBalanceId.set(
        request.leaveBalanceId,
        (approvedNotYetStartedByBalanceId.get(request.leaveBalanceId) ?? 0) +
          quantity,
      );
      continue;
    }

    const key = contractLeaveTypeKey(request.contractId, request.leaveTypeId);
    approvedNotYetStartedByContractLeaveType.set(
      key,
      (approvedNotYetStartedByContractLeaveType.get(key) ?? 0) + quantity,
    );
  }

  return balances.map((balance) => {
    const approvedNotYetStarted =
      (approvedNotYetStartedByBalanceId.get(balance.id) ?? 0) +
      (approvedNotYetStartedByContractLeaveType.get(
        contractLeaveTypeKey(balance.contractId, balance.leaveTypeId),
      ) ?? 0);
    const split = splitLeaveTakenForDisplay(
      balance.taken.toString(),
      String(approvedNotYetStarted),
    );

    return {
      id: balance.id,
      employeeId: balance.employeeId,
      employeeNumber: balance.employee.employeeNumber,
      employeeName: `${balance.employee.firstName} ${balance.employee.lastName}`,
      contractId: balance.contractId,
      contractNumber: balance.contract.contractNumber,
      contractIsCurrent: balance.contract.isCurrent,
      cycleStart: balance.cycleStart.toISOString(),
      cycleEnd: balance.cycleEnd.toISOString(),
      isCurrentCycle: isDateWithinCycle(
        asOf,
        balance.cycleStart,
        balance.cycleEnd,
      ),
      leaveTypeCode: balance.leaveType.code,
      leaveTypeName: balance.leaveType.name,
      openingBalance: balance.openingBalance.toString(),
      entitlement: balance.entitlement.toString(),
      accrued: balance.accrued.toString(),
      carriedForward: balance.carriedForward.toString(),
      adjustments: balance.adjustments.toString(),
      reserved: balance.reserved.toString(),
      approved: split.approved,
      taken: split.taken,
      expired: balance.expired.toString(),
      availableBalance: balance.availableBalance.toString(),
    };
  });
}
