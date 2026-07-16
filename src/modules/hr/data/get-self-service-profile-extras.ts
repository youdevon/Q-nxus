import { LeaveRequestStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isLeavePeriodStarted,
  splitLeaveTakenForDisplay,
} from "@/src/modules/hr/lib/leave-balance-math";
import {
  getVacationForfeitureWarningForEmployee,
  type VacationForfeitureWarning,
} from "@/src/modules/hr/data/get-vacation-forfeiture-warning";
import {
  describeSupervisorResolutionIssue,
  resolveEmployeeSupervisor,
  type ResolvedEmployeeSupervisor,
} from "@/src/modules/hr/data/resolve-employee-supervisor";

export type SelfServiceSupervisorSummary = {
  positionTitle: string | null;
  employeeName: string | null;
  employeeNumber: string | null;
  isActing: boolean;
  issue: ResolvedEmployeeSupervisor["resolutionIssue"];
  issueMessage: string | null;
};

export type SelfServiceLeaveBalanceSummary = {
  leaveTypeName: string;
  leaveTypeCode: string;
  availableBalance: string;
  reserved: string;
  /** Approved leave that has not started yet (still in ledger `taken`). */
  approved: string;
  /** Approved leave that has started or completed. */
  taken: string;
  cycleEnd: string;
};

export type SelfServiceVacationForfeitureWarning = VacationForfeitureWarning;

export type SelfServiceProfileExtras = {
  supervisor: SelfServiceSupervisorSummary;
  leaveBalances: SelfServiceLeaveBalanceSummary[];
  vacationForfeitureWarning: SelfServiceVacationForfeitureWarning | null;
};

export async function getSelfServiceProfileExtras(
  employeeId: string,
): Promise<SelfServiceProfileExtras> {
  const [
    supervisor,
    leaveBalances,
    approvedRequests,
    vacationForfeitureWarning,
  ] = await Promise.all([
    resolveEmployeeSupervisor(employeeId),
    prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId,
        contract: {
          isCurrent: true,
        },
        leaveType: {
          isActive: true,
        },
      },
      orderBy: [
        {
          leaveType: {
            sortOrder: "asc",
          },
        },
      ],
      select: {
        id: true,
        leaveTypeId: true,
        availableBalance: true,
        reserved: true,
        taken: true,
        cycleEnd: true,
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
        employeeId,
        status: LeaveRequestStatus.APPROVED,
        contract: {
          isCurrent: true,
        },
      },
      select: {
        leaveBalanceId: true,
        leaveTypeId: true,
        startDate: true,
        requestedQuantity: true,
      },
    }),
    getVacationForfeitureWarningForEmployee(employeeId),
  ]);

  const approvedNotYetStartedByBalanceId = new Map<string, number>();
  const approvedNotYetStartedByLeaveTypeId = new Map<string, number>();

  for (const request of approvedRequests) {
    if (isLeavePeriodStarted(request.startDate)) {
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

    approvedNotYetStartedByLeaveTypeId.set(
      request.leaveTypeId,
      (approvedNotYetStartedByLeaveTypeId.get(request.leaveTypeId) ?? 0) +
        quantity,
    );
  }

  return {
    supervisor: mapSupervisor(supervisor),
    leaveBalances: leaveBalances.map((balance) => {
      const approvedNotYetStarted =
        (approvedNotYetStartedByBalanceId.get(balance.id) ?? 0) +
        (approvedNotYetStartedByLeaveTypeId.get(balance.leaveTypeId) ?? 0);
      const split = splitLeaveTakenForDisplay(
        balance.taken.toString(),
        String(approvedNotYetStarted),
      );

      return {
        leaveTypeName: balance.leaveType.name,
        leaveTypeCode: balance.leaveType.code,
        availableBalance: balance.availableBalance.toString(),
        reserved: balance.reserved.toString(),
        approved: split.approved,
        taken: split.taken,
        cycleEnd: balance.cycleEnd.toISOString().slice(0, 10),
      };
    }),
    vacationForfeitureWarning,
  };
}

function mapSupervisor(
  supervisor: ResolvedEmployeeSupervisor | null,
): SelfServiceSupervisorSummary {
  if (!supervisor) {
    return {
      positionTitle: null,
      employeeName: null,
      employeeNumber: null,
      isActing: false,
      issue: "NO_POSITION",
      issueMessage: describeSupervisorResolutionIssue(null),
    };
  }

  const hasPerson = Boolean(supervisor.supervisorEmployeeName);

  return {
    positionTitle: supervisor.supervisorPositionTitle || null,
    employeeName: supervisor.supervisorEmployeeName,
    employeeNumber: supervisor.supervisorEmployeeNumber,
    isActing: supervisor.isActingSupervisor,
    issue: supervisor.resolutionIssue,
    issueMessage: hasPerson
      ? null
      : describeSupervisorResolutionIssue(supervisor),
  };
}
