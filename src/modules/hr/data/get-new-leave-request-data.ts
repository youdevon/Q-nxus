import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user";
import {
  describeSupervisorResolutionIssue,
  resolveEmployeeSupervisor,
} from "@/src/modules/hr/data/resolve-employee-supervisor";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/lib/employee-position";
import type { LeaveRequestMode } from "@/src/modules/hr/lib/leave-request-mode";
import { createContractLeaveBalances } from "@/src/modules/hr/services/create-contract-leave-balances";

export type GetNewLeaveRequestDataOptions = {
  /** Employee the leave request is for. */
  employeeId: string;
  /** Actor creating the request (for balance generation audit). */
  actingUserId: string;
  /** Must match the employee's organization. */
  organizationId: string;
  mode: LeaveRequestMode;
};

export async function getNewLeaveRequestData(
  options: GetNewLeaveRequestDataOptions,
) {
  const employee = await prisma.employee.findFirst({
    where: {
      id: options.employeeId,
      organizationId: options.organizationId,
      isArchived: false,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      organizationId: true,
      position: { select: { title: true } },
      assignments: {
        where: { isCurrent: true },
        take: 1,
        select: {
          position: { select: { title: true } },
        },
      },
    },
  });

  if (!employee) {
    return null;
  }

  async function loadBalances() {
    return prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId: employee!.id,
        contract: {
          isCurrent: true,
        },
        leaveType: {
          isActive: true,
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
        contractId: true,
        leaveTypeId: true,
        cycleStart: true,
        cycleEnd: true,
        entitlement: true,
        reserved: true,
        taken: true,
        availableBalance: true,
        contract: {
          select: {
            contractNumber: true,
            jobTitle: true,
            endDate: true,
          },
        },
        leaveType: {
          select: {
            code: true,
            name: true,
            requiresDocument: true,
            documentRequiredAfter: true,
          },
        },
      },
    });
  }

  let balances = await loadBalances();

  if (balances.length === 0) {
    const currentContract = await prisma.employmentContract.findFirst({
      where: {
        employeeId: employee.id,
        isCurrent: true,
        endDate: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    });

    if (currentContract) {
      try {
        await createContractLeaveBalances(
          currentContract.id,
          options.actingUserId,
        );
        balances = await loadBalances();
      } catch (error) {
        console.error(
          "Unable to generate leave balances for current contract:",
          error,
        );
      }
    }
  }

  const [currentContract, supervisor, holidays] = await Promise.all([
    prisma.employmentContract.findFirst({
      where: {
        employeeId: employee.id,
        isCurrent: true,
      },
      select: {
        id: true,
        endDate: true,
        contractNumber: true,
        jobTitle: true,
      },
    }),
    resolveEmployeeSupervisor(employee.id),
    prisma.organizationHoliday.findMany({
      where: {
        organizationId: employee.organizationId,
        isActive: true,
      },
      select: {
        holidayDate: true,
        isRecurring: true,
      },
    }),
  ]);

  const positionTitle = resolveEmployeePositionTitle({
    assignmentPositionTitle: employee.assignments[0]?.position?.title,
    positionTitle: employee.position?.title,
    contractJobTitle: currentContract?.jobTitle,
  });

  const holidayDates = [
    ...new Set(
      holidays.map((holiday) => holiday.holidayDate.toISOString().slice(0, 10)),
    ),
  ];

  // Expand recurring holidays for the next 18 months for client preview.
  const previewStart = new Date();
  const previewEnd = new Date(previewStart);
  previewEnd.setUTCMonth(previewEnd.getUTCMonth() + 18);
  const recurringDates = new Set(holidayDates);

  for (const holiday of holidays.filter((item) => item.isRecurring)) {
    const month = holiday.holidayDate.getUTCMonth();
    const day = holiday.holidayDate.getUTCDate();
    const cursor = new Date(
      Date.UTC(previewStart.getUTCFullYear(), previewStart.getUTCMonth(), 1),
    );

    while (cursor <= previewEnd) {
      const year = cursor.getUTCFullYear();
      const candidate = new Date(Date.UTC(year, month, day));
      if (
        candidate.getUTCMonth() === month &&
        candidate >= previewStart &&
        candidate <= previewEnd
      ) {
        recurringDates.add(candidate.toISOString().slice(0, 10));
      }
      cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    }
  }

  return {
    mode: options.mode,
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName: `${employee.firstName} ${employee.lastName}`,
    },
    currentContract: currentContract
      ? {
          id: currentContract.id,
          contractNumber: currentContract.contractNumber,
          positionTitle: positionTitle ?? currentContract.jobTitle,
          hasEndDate: Boolean(currentContract.endDate),
        }
      : null,
    supervisor: supervisor
      ? {
          canApprove: Boolean(supervisor.supervisorUserId),
          positionTitle: supervisor.supervisorPositionTitle,
          employeeName: supervisor.supervisorEmployeeName,
          employeeNumber: supervisor.supervisorEmployeeNumber,
          issue: supervisor.resolutionIssue,
          issueMessage: describeSupervisorResolutionIssue(supervisor),
        }
      : {
          canApprove: false,
          positionTitle: null,
          employeeName: null,
          employeeNumber: null,
          issue: "NO_POSITION" as const,
          issueMessage: describeSupervisorResolutionIssue(null),
        },
    holidayDates: [...recurringDates],
    balances: balances.map((balance) => ({
      id: balance.id,
      contractId: balance.contractId,
      leaveTypeId: balance.leaveTypeId,
      contractNumber: balance.contract.contractNumber,
      positionTitle: positionTitle ?? balance.contract.jobTitle,
      cycleStart: balance.cycleStart.toISOString(),
      cycleEnd: balance.cycleEnd.toISOString(),
      leaveTypeCode: balance.leaveType.code,
      leaveTypeName: balance.leaveType.name,
      requiresDocument: balance.leaveType.requiresDocument,
      documentRequiredAfter:
        balance.leaveType.documentRequiredAfter?.toString() ?? null,
      entitlement: balance.entitlement.toString(),
      reserved: balance.reserved.toString(),
      taken: balance.taken.toString(),
      availableBalance: balance.availableBalance.toString(),
    })),
  };
}

/** Convenience loader for the authenticated employee's own leave form. */
export async function getSelfNewLeaveRequestData() {
  const user = await requireCurrentUser();

  if (!user.employeeId || !user.organizationId) {
    return null;
  }

  return getNewLeaveRequestData({
    employeeId: user.employeeId,
    actingUserId: user.id,
    organizationId: user.organizationId,
    mode: "self",
  });
}

export type NewLeaveRequestData = NonNullable<
  Awaited<ReturnType<typeof getNewLeaveRequestData>>
>;
