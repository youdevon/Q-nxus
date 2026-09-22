import { prisma } from "@/lib/prisma";

export type LeaveBalanceRosterRow = {
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
  leaveTypeCode: string;
  leaveTypeName: string;
  cycleStart: string;
  cycleEnd: string;
  entitlement: string;
  taken: string;
  reserved: string;
  availableBalance: string;
};

export type LeaveBalanceRosterReport = {
  rows: LeaveBalanceRosterRow[];
  employeeCount: number;
};

/**
 * Org-wide leave balances for active employees on current contracts.
 * Reuses the same balance rows as People → Leave balances.
 */
export async function getLeaveBalanceRosterReport(): Promise<LeaveBalanceRosterReport> {
  const balances = await prisma.employeeLeaveBalance.findMany({
    where: {
      employee: {
        isArchived: false,
        employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] },
      },
      contract: { isCurrent: true },
    },
    orderBy: [
      { employee: { lastName: "asc" } },
      { employee: { firstName: "asc" } },
      { leaveType: { sortOrder: "asc" } },
      { cycleStart: "desc" },
    ],
    select: {
      cycleStart: true,
      cycleEnd: true,
      entitlement: true,
      taken: true,
      reserved: true,
      availableBalance: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
      leaveType: {
        select: { code: true, name: true },
      },
    },
  });

  const employeeIds = new Set<string>();

  const rows: LeaveBalanceRosterRow[] = balances.map((balance) => {
    employeeIds.add(balance.employee.id);

    return {
      employeeId: balance.employee.id,
      employeeNumber: balance.employee.employeeNumber,
      displayName: `${balance.employee.firstName} ${balance.employee.lastName}`.trim(),
      departmentName: balance.employee.department?.name ?? null,
      leaveTypeCode: balance.leaveType.code,
      leaveTypeName: balance.leaveType.name,
      cycleStart: balance.cycleStart.toISOString().slice(0, 10),
      cycleEnd: balance.cycleEnd.toISOString().slice(0, 10),
      entitlement: balance.entitlement.toString(),
      taken: balance.taken.toString(),
      reserved: balance.reserved.toString(),
      availableBalance: balance.availableBalance.toString(),
    };
  });

  return {
    rows,
    employeeCount: employeeIds.size,
  };
}
