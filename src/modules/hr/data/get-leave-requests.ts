import { prisma } from "@/lib/prisma"
import {
  requireCurrentEmployeeUser,
  requireCurrentUser,
} from "@/src/modules/auth/data/get-current-user"
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities"

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function serializeRequest(
  request: {
    id: string
    requestNumber: string | null
    startDate: Date
    endDate: Date
    requestedQuantity: { toString(): string }
    reason: string | null
    employeeComment: string | null
    status: string
    submittedAt: Date | null
    approvedAt: Date | null
    rejectedAt: Date | null
    cancelledAt: Date | null
    withdrawnAt: Date | null
    finalDecisionComment: string | null
    createdAt: Date
    leaveType: {
      code: string
      name: string
      colour: string | null
    }
    contract: {
      contractNumber: string | null
      jobTitle: string
    }
    employee: {
      id: string
      employeeNumber: string
      firstName: string
      lastName: string
    }
    finalDecisionBy: {
      firstName: string
      lastName: string
    } | null
    approvalSteps: {
      id: string
      stepNumber: number
      status: string
      decidedAt: Date | null
      decisionComment: string | null
      approverUserId: string | null
      approverPosition: {
        title: string
      } | null
      approverUser: {
        firstName: string
        lastName: string
        email: string
      } | null
    }[]
    days: {
      leaveDate: Date
      quantity: { toString(): string }
      isWorkingDay: boolean
    }[]
  },
) {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    startDate: formatDate(request.startDate),
    endDate: formatDate(request.endDate),
    requestedQuantity: request.requestedQuantity.toString(),
    reason: request.reason,
    employeeComment: request.employeeComment,
    status: request.status,
    submittedAt: request.submittedAt?.toISOString() ?? null,
    approvedAt: request.approvedAt?.toISOString() ?? null,
    rejectedAt: request.rejectedAt?.toISOString() ?? null,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    withdrawnAt: request.withdrawnAt?.toISOString() ?? null,
    finalDecisionComment: request.finalDecisionComment,
    createdAt: request.createdAt.toISOString(),
    leaveTypeCode: request.leaveType.code,
    leaveTypeName: request.leaveType.name,
    leaveTypeColour: request.leaveType.colour,
    contractNumber: request.contract.contractNumber,
    jobTitle: request.contract.jobTitle,
    employeeId: request.employee.id,
    employeeNumber: request.employee.employeeNumber,
    employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
    finalDecisionByName: request.finalDecisionBy
      ? `${request.finalDecisionBy.firstName} ${request.finalDecisionBy.lastName}`
      : null,
    approvalSteps: request.approvalSteps.map((step) => ({
      id: step.id,
      stepNumber: step.stepNumber,
      status: step.status,
      decidedAt: step.decidedAt?.toISOString() ?? null,
      decisionComment: step.decisionComment,
      approverUserId: step.approverUserId,
      approverPositionTitle:
        step.approverPosition?.title ?? null,
      approverName: step.approverUser
        ? `${step.approverUser.firstName} ${step.approverUser.lastName}`
        : null,
      approverEmail: step.approverUser?.email ?? null,
    })),
    days: request.days.map((day) => ({
      leaveDate: formatDate(day.leaveDate),
      quantity: day.quantity.toString(),
      isWorkingDay: day.isWorkingDay,
    })),
  }
}

const requestSelect = {
  id: true,
  requestNumber: true,
  startDate: true,
  endDate: true,
  requestedQuantity: true,
  reason: true,
  employeeComment: true,
  status: true,
  submittedAt: true,
  approvedAt: true,
  rejectedAt: true,
  cancelledAt: true,
  withdrawnAt: true,
  finalDecisionComment: true,
  createdAt: true,
  leaveType: {
    select: {
      code: true,
      name: true,
      colour: true,
    },
  },
  contract: {
    select: {
      contractNumber: true,
      jobTitle: true,
    },
  },
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
    },
  },
  finalDecisionBy: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  approvalSteps: {
    orderBy: {
      stepNumber: "asc" as const,
    },
    select: {
      id: true,
      stepNumber: true,
      status: true,
      decidedAt: true,
      decisionComment: true,
      approverUserId: true,
      approverPosition: {
        select: {
          title: true,
        },
      },
      approverUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
  days: {
    orderBy: {
      leaveDate: "asc" as const,
    },
    select: {
      leaveDate: true,
      quantity: true,
      isWorkingDay: true,
    },
  },
} as const

export async function getLeaveWorkspace() {
  const user = await requireCurrentEmployeeUser()
  const capabilities = await getUserCapabilities(user.id)
  const canReviewAll =
    capabilities?.canAny("leave.approve", "leave.manage") ??
    false

  const [myRequests, pendingApprovals, balances] =
    await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          employeeId: user.employeeId,
        },
        orderBy: [
          {
            startDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        select: requestSelect,
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: {
            in: ["SUBMITTED", "PENDING_APPROVAL"],
          },
          approvalSteps: {
            some: canReviewAll
              ? {
                  status: "PENDING",
                }
              : {
                  status: "PENDING",
                  approverUserId: user.id,
                },
          },
        },
        orderBy: [
          {
            submittedAt: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
        select: requestSelect,
      }),
      prisma.employeeLeaveBalance.findMany({
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
            leaveType: {
              sortOrder: "asc",
            },
          },
        ],
        select: {
          id: true,
          availableBalance: true,
          reserved: true,
          taken: true,
          leaveType: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      }),
    ])

  return {
    user: {
      id: user.id,
      employeeId: user.employeeId,
      employeeNumber: user.employee.employeeNumber,
      employeeName: `${user.employee.firstName} ${user.employee.lastName}`,
    },
    myRequests: myRequests.map(serializeRequest),
    pendingApprovals: pendingApprovals.map(serializeRequest),
    balances: balances.map((balance) => ({
      id: balance.id,
      leaveTypeCode: balance.leaveType.code,
      leaveTypeName: balance.leaveType.name,
      availableBalance: balance.availableBalance.toString(),
      reserved: balance.reserved.toString(),
      taken: balance.taken.toString(),
    })),
  }
}

export type LeaveWorkspaceData = Awaited<
  ReturnType<typeof getLeaveWorkspace>
>

export type LeaveRequestSummary =
  LeaveWorkspaceData["myRequests"][number]

export async function getLeaveRequestDetail(
  leaveRequestId: string,
) {
  const user = await requireCurrentUser()

  const request = await prisma.leaveRequest.findUnique({
    where: {
      id: leaveRequestId,
    },
    select: {
      ...requestSelect,
      organizationId: true,
      employeeId: true,
      createdByUserId: true,
    },
  })

  if (!request) {
    return null
  }

  const canView =
    request.employeeId === user.employeeId ||
    request.createdByUserId === user.id ||
    request.approvalSteps.some(
      (step) => step.approverUserId === user.id,
    )

  if (!canView) {
    return null
  }

  const pendingStep = request.approvalSteps.find(
    (step) =>
      step.status === "PENDING" &&
      step.approverUserId === user.id,
  )

  const isOwner = request.employeeId === user.employeeId
  const today = new Date()
  const todayUtc = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  )
  const leaveStartUtc = new Date(
    Date.UTC(
      request.startDate.getUTCFullYear(),
      request.startDate.getUTCMonth(),
      request.startDate.getUTCDate(),
    ),
  )

  return {
    ...serializeRequest(request),
    canDecide:
      Boolean(pendingStep) &&
      (request.status === "SUBMITTED" ||
        request.status === "PENDING_APPROVAL"),
    canWithdraw:
      isOwner &&
      (request.status === "SUBMITTED" ||
        request.status === "PENDING_APPROVAL"),
    canCancel:
      isOwner &&
      request.status === "APPROVED" &&
      leaveStartUtc > todayUtc,
    isOwner,
  }
}

export type LeaveRequestDetail = NonNullable<
  Awaited<ReturnType<typeof getLeaveRequestDetail>>
>
