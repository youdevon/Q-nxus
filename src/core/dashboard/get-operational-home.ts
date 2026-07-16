import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { getVacationForfeitureWarningForEmployee } from "@/src/modules/hr/data/get-vacation-forfeiture-warning";
import type { VacationForfeitureWarning } from "@/src/modules/hr/data/get-vacation-forfeiture-warning";
import { notifyContractExpiryReminders } from "@/src/modules/hr/services/notify-contract-expiry";
import { notifyVacationForfeitureReminders } from "@/src/modules/hr/services/notify-vacation-forfeiture";

function startOfUtcDay(value = new Date()): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type OperationalHomeDashboard = {
  userName: string;
  pendingLeaveForMe: {
    id: string;
    requestNumber: string | null;
    employeeName: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
  }[];
  pendingLeaveCount: number;
  contractsExpiring: {
    id: string;
    employeeId: string;
    employeeName: string;
    endDate: string;
    daysUntilExpiry: number;
    jobTitle: string;
  }[];
  contractsExpiringCount: number;
  currentlyOnLeaveCount: number;
  canApproveLeave: boolean;
  canViewLeave: boolean;
  canViewContracts: boolean;
  vacationForfeitureWarning: VacationForfeitureWarning | null;
};

type PendingLeaveRow = {
  id: string;
  requestNumber: string | null;
  startDate: Date;
  endDate: Date;
  leaveType: { name: string };
  employee: { firstName: string; lastName: string };
};

type ContractExpiringRow = {
  id: string;
  endDate: Date | null;
  jobTitle: string;
  employeeId: string;
  employee: { firstName: string; lastName: string };
};

export async function getOperationalHomeDashboard(): Promise<OperationalHomeDashboard | null> {
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: capabilities.userId },
    select: {
      firstName: true,
      lastName: true,
      employeeId: true,
      employee: {
        select: { organizationId: true },
      },
    },
  });

  if (!user) {
    return null;
  }

  const canApproveLeave = capabilities.canAny("leave.approve", "leave.manage");
  const canViewLeave = capabilities.canAny(
    "leave.request",
    "leave.approve",
    "leave.manage",
  );
  const canViewContracts = capabilities.canAny(
    "contracts.view",
    "contracts.manage",
    "people.manage",
  );
  const canManageContracts = capabilities.canAny(
    "contracts.manage",
    "people.manage",
  );
  const canManageLeave = capabilities.can("leave.manage");

  if (canManageContracts) {
    try {
      await notifyContractExpiryReminders();
    } catch (error) {
      console.error("Contract expiry reminder pass failed:", error);
    }
  }

  try {
    if (canManageLeave || canManageContracts) {
      await notifyVacationForfeitureReminders();
    } else if (user.employeeId) {
      await notifyVacationForfeitureReminders({
        employeeId: user.employeeId,
      });
    }
  } catch (error) {
    console.error("Vacation forfeiture reminder pass failed:", error);
  }

  const today = startOfUtcDay();
  const in90Days = addUtcDays(today, 90);
  const organizationId = user.employee?.organizationId ?? null;
  const canCountOnLeave = canViewLeave && Boolean(organizationId);

  const pendingLeaveWhere: Prisma.LeaveRequestWhereInput = capabilities.can(
    "leave.manage",
  )
    ? {
        status: {
          in: ["SUBMITTED", "PENDING_APPROVAL", "MANAGER_APPROVED"],
        },
        approvalSteps: {
          some: { status: "PENDING" },
        },
      }
    : {
        status: {
          in: ["SUBMITTED", "PENDING_APPROVAL"],
        },
        approvalSteps: {
          some: {
            status: "PENDING",
            approverUserId: capabilities.userId,
          },
        },
      };

  const contractsExpiringWhere: Prisma.EmploymentContractWhereInput = {
    isCurrent: true,
    endDate: {
      not: null,
      lte: in90Days,
    },
  };

  let pendingLeaveForMe: PendingLeaveRow[] = [];
  let pendingLeaveCount = 0;
  let contractsExpiring: ContractExpiringRow[] = [];
  let contractsExpiringCount = 0;
  let currentlyOnLeaveRows: { employeeId: string }[] = [];
  let vacationForfeitureWarning: OperationalHomeDashboard["vacationForfeitureWarning"] =
    null;

  await Promise.all([
    (async () => {
      if (!canApproveLeave) {
        return;
      }

      const [rows, count] = await Promise.all([
        prisma.leaveRequest.findMany({
          where: pendingLeaveWhere,
          orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
          take: 8,
          select: {
            id: true,
            requestNumber: true,
            startDate: true,
            endDate: true,
            leaveType: { select: { name: true } },
            employee: {
              select: { firstName: true, lastName: true },
            },
          },
        }),
        prisma.leaveRequest.count({ where: pendingLeaveWhere }),
      ]);

      pendingLeaveForMe = rows;
      pendingLeaveCount = count;
    })(),
    (async () => {
      if (!canViewContracts) {
        return;
      }

      const [rows, count] = await Promise.all([
        prisma.employmentContract.findMany({
          where: contractsExpiringWhere,
          orderBy: { endDate: "asc" },
          take: 8,
          select: {
            id: true,
            endDate: true,
            jobTitle: true,
            employeeId: true,
            employee: {
              select: { firstName: true, lastName: true },
            },
          },
        }),
        prisma.employmentContract.count({ where: contractsExpiringWhere }),
      ]);

      contractsExpiring = rows;
      contractsExpiringCount = count;
    })(),
    (async () => {
      if (!canCountOnLeave || !organizationId) {
        return;
      }

      currentlyOnLeaveRows = await prisma.leaveRequest.findMany({
        where: {
          organizationId,
          status: "APPROVED",
          startDate: { lte: today },
          endDate: { gte: today },
        },
        select: { employeeId: true },
      });
    })(),
    (async () => {
      if (!user.employeeId) {
        return;
      }

      vacationForfeitureWarning = await getVacationForfeitureWarningForEmployee(
        user.employeeId,
        today,
      );
    })(),
  ]);

  return {
    userName: `${user.firstName} ${user.lastName}`,
    canApproveLeave,
    canViewLeave,
    canViewContracts,
    currentlyOnLeaveCount: new Set(
      currentlyOnLeaveRows.map((row) => row.employeeId),
    ).size,
    pendingLeaveCount,
    pendingLeaveForMe: pendingLeaveForMe.map((request) => ({
      id: request.id,
      requestNumber: request.requestNumber,
      employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
      leaveTypeName: request.leaveType.name,
      startDate: request.startDate.toISOString().slice(0, 10),
      endDate: request.endDate.toISOString().slice(0, 10),
    })),
    contractsExpiringCount,
    contractsExpiring: contractsExpiring
      .filter((contract) => contract.endDate)
      .map((contract) => {
        const endDate = contract.endDate!;
        const daysUntilExpiry = Math.ceil(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          id: contract.id,
          employeeId: contract.employeeId,
          employeeName: `${contract.employee.firstName} ${contract.employee.lastName}`,
          endDate: endDate.toISOString().slice(0, 10),
          daysUntilExpiry,
          jobTitle: contract.jobTitle,
        };
      }),
    vacationForfeitureWarning,
  };
}
