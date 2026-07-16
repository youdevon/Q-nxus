import { prisma } from "@/lib/prisma"
import { requireCurrentEmployeeUser } from "@/src/modules/auth/data/get-current-user"
import {
  describeSupervisorResolutionIssue,
  resolveEmployeeSupervisor,
} from "@/src/modules/hr/data/resolve-employee-supervisor"
import { createContractLeaveBalances } from "@/src/modules/hr/services/create-contract-leave-balances"

export async function getNewLeaveRequestData() {
  const user = await requireCurrentEmployeeUser()

  async function loadBalances() {
    return prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId: user.employeeId,
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
          },
        },
      },
    })
  }

  let balances = await loadBalances()

  if (balances.length === 0) {
    const currentContract =
      await prisma.employmentContract.findFirst({
        where: {
          employeeId: user.employeeId,
          isCurrent: true,
          endDate: {
            not: null,
          },
        },
        select: {
          id: true,
        },
      })

    if (currentContract) {
      try {
        await createContractLeaveBalances(
          currentContract.id,
          user.id,
        )
        balances = await loadBalances()
      } catch (error) {
        console.error(
          "Unable to generate leave balances for current contract:",
          error,
        )
      }
    }
  }

  const [currentContract, supervisor] = await Promise.all([
    prisma.employmentContract.findFirst({
      where: {
        employeeId: user.employeeId,
        isCurrent: true,
      },
      select: {
        id: true,
        endDate: true,
        contractNumber: true,
        jobTitle: true,
      },
    }),
    resolveEmployeeSupervisor(user.employeeId),
  ])

  return {
    user: {
      id: user.id,
      employeeId: user.employeeId,
      employeeNumber: user.employee.employeeNumber,
      employeeName: `${user.employee.firstName} ${user.employee.lastName}`,
    },
    currentContract: currentContract
      ? {
          id: currentContract.id,
          contractNumber: currentContract.contractNumber,
          jobTitle: currentContract.jobTitle,
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
          issueMessage:
            describeSupervisorResolutionIssue(supervisor),
        }
      : {
          canApprove: false,
          positionTitle: null,
          employeeName: null,
          employeeNumber: null,
          issue: "NO_POSITION" as const,
          issueMessage: describeSupervisorResolutionIssue(null),
        },
    balances: balances.map((balance) => ({
      id: balance.id,
      contractId: balance.contractId,
      leaveTypeId: balance.leaveTypeId,
      contractNumber: balance.contract.contractNumber,
      jobTitle: balance.contract.jobTitle,
      cycleStart: balance.cycleStart.toISOString(),
      cycleEnd: balance.cycleEnd.toISOString(),
      leaveTypeCode: balance.leaveType.code,
      leaveTypeName: balance.leaveType.name,
      requiresDocument: balance.leaveType.requiresDocument,
      entitlement: balance.entitlement.toString(),
      reserved: balance.reserved.toString(),
      taken: balance.taken.toString(),
      availableBalance: balance.availableBalance.toString(),
    })),
  }
}

export type NewLeaveRequestData = Awaited<
  ReturnType<typeof getNewLeaveRequestData>
>
