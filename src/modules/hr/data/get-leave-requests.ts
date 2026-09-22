import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/lib/employee-position";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function serializeRequest(request: {
  id: string;
  requestNumber: string | null;
  startDate: Date;
  endDate: Date;
  requestedQuantity: { toString(): string };
  reason: string | null;
  employeeComment: string | null;
  status: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  withdrawnAt: Date | null;
  finalDecisionComment: string | null;
  createdAt: Date;
  leaveType: {
    code: string;
    name: string;
    colour: string | null;
  };
  contract: {
    contractNumber: string | null;
    jobTitle: string;
  };
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    position: {
      title: string;
    } | null;
    assignments: {
      position: {
        title: string;
      } | null;
    }[];
  };
  finalDecisionBy: {
    firstName: string;
    lastName: string;
  } | null;
  approvalSteps?: {
    id: string;
    stepNumber: number;
    status: string;
    decidedAt: Date | null;
    decisionComment: string | null;
    approverUserId: string | null;
    approverPosition: {
      title: string;
    } | null;
    approverUser: {
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  }[];
  acknowledgements?: {
    id: string;
    sequenceNumber: number;
    status: string;
    acknowledgedAt: Date | null;
    comment: string | null;
    acknowledgerUserId: string | null;
    position: {
      title: string;
    };
    acknowledgerUser: {
      firstName: string;
      lastName: string;
      email: string;
    } | null;
    acknowledgerEmployee: {
      firstName: string;
      lastName: string;
    } | null;
  }[];
}) {
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
    positionTitle:
      resolveEmployeePositionTitle({
        assignmentPositionTitle:
          request.employee.assignments[0]?.position?.title,
        positionTitle: request.employee.position?.title,
        contractJobTitle: request.contract.jobTitle,
      }) ?? request.contract.jobTitle,
    employeeId: request.employee.id,
    employeeNumber: request.employee.employeeNumber,
    employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
    finalDecisionByName: request.finalDecisionBy
      ? `${request.finalDecisionBy.firstName} ${request.finalDecisionBy.lastName}`
      : null,
    approvalSteps: (request.approvalSteps ?? []).map((step) => ({
      id: step.id,
      stepNumber: step.stepNumber,
      status: step.status,
      decidedAt: step.decidedAt?.toISOString() ?? null,
      decisionComment: step.decisionComment,
      approverUserId: step.approverUserId,
      approverPositionTitle: step.approverPosition?.title ?? null,
      approverName: step.approverUser
        ? `${step.approverUser.firstName} ${step.approverUser.lastName}`
        : null,
      approverEmail: step.approverUser?.email ?? null,
    })),
    acknowledgements: (request.acknowledgements ?? []).map((item) => ({
      id: item.id,
      sequenceNumber: item.sequenceNumber,
      status: item.status,
      acknowledgedAt: item.acknowledgedAt?.toISOString() ?? null,
      comment: item.comment,
      acknowledgerUserId: item.acknowledgerUserId,
      positionTitle: item.position.title,
      acknowledgerName: item.acknowledgerUser
        ? `${item.acknowledgerUser.firstName} ${item.acknowledgerUser.lastName}`
        : item.acknowledgerEmployee
          ? `${item.acknowledgerEmployee.firstName} ${item.acknowledgerEmployee.lastName}`
          : null,
      acknowledgerEmail: item.acknowledgerUser?.email ?? null,
    })),
  };
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
      position: {
        select: {
          title: true,
        },
      },
      assignments: {
        where: {
          isCurrent: true,
        },
        take: 1,
        select: {
          position: {
            select: {
              title: true,
            },
          },
        },
      },
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
  acknowledgements: {
    orderBy: {
      sequenceNumber: "asc" as const,
    },
    select: {
      id: true,
      sequenceNumber: true,
      status: true,
      acknowledgedAt: true,
      comment: true,
      acknowledgerUserId: true,
      position: {
        select: {
          title: true,
        },
      },
      acknowledgerUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      acknowledgerEmployee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} as const;

/** List/card rows — omit approval/ack graphs until the detail page. */
const listRequestSelect = {
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
      position: {
        select: {
          title: true,
        },
      },
      assignments: {
        where: {
          isCurrent: true,
        },
        take: 1,
        select: {
          position: {
            select: {
              title: true,
            },
          },
        },
      },
    },
  },
  finalDecisionBy: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
} as const;

const WORKSPACE_QUEUE_LIMIT = 40;
const CURRENTLY_ON_LEAVE_LIMIT = 100;
const MY_LEAVE_REQUESTS_LIMIT = 50;

type ListRequestRow = Prisma.LeaveRequestGetPayload<{
  select: typeof listRequestSelect;
}>;

function currentYearStartUtc(): Date {
  const year = new Date().getUTCFullYear();

  return new Date(Date.UTC(year, 0, 1));
}

function todayUtcDate(): Date {
  const today = new Date();

  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
}

function currentContractBalanceWhere(
  scope: "self" | "org",
  organizationId: string,
  employeeId: string | null,
) {
  return {
    contract: {
      isCurrent: true,
    },
    leaveType: {
      isActive: true,
    },
    ...(scope === "self" && employeeId
      ? {
          employeeId,
        }
      : {
          employee: {
            organizationId,
          },
        }),
  } as const;
}

function leaveRequestScopeWhere(
  scope: "self" | "org",
  organizationId: string,
  employeeId: string | null,
) {
  return scope === "self" && employeeId
    ? {
        employeeId,
      }
    : {
        organizationId,
      };
}

const awaitingDecisionStatuses = [
  "SUBMITTED",
  "AWAITING_ACKNOWLEDGEMENT",
  "PENDING_APPROVAL",
  "MANAGER_APPROVED",
] as const;

export async function getLeaveWorkspace(options?: {
  /** Cap the main request list. Default 100. Queues use {@link WORKSPACE_QUEUE_LIMIT}. */
  requestLimit?: number;
}) {
  const user = await requireCurrentUser();
  const capabilities = await getUserCapabilities();
  const canManageLeave = capabilities?.can("leave.manage") ?? false;
  const canApprove =
    (capabilities?.can("leave.approve") ?? false) || canManageLeave;
  const canViewDirectory =
    capabilities?.can("people.directory.view") ?? false;
  const canManageLeaveWorkspace =
    canApprove || canManageLeave || canViewDirectory;

  if (!canManageLeaveWorkspace) {
    throw new Error("You do not have permission to manage leave requests.");
  }

  // Management workspace is always organization-scoped.
  const statsScope = "org" as const;
  const yearStart = currentYearStartUtc();
  const today = todayUtcDate();
  const organizationId =
    user.employee?.organizationId ?? user.organizationId;
  const balanceScopeWhere = currentContractBalanceWhere(
    statsScope,
    organizationId,
    null,
  );
  const requestScopeWhere = leaveRequestScopeWhere(
    statsScope,
    organizationId,
    null,
  );
  const requestLimit = Math.max(
    25,
    Math.min(options?.requestLimit ?? 100, 250),
  );

  const myApprovalsWhere: Prisma.LeaveRequestWhereInput = {
    organizationId,
    status: {
      in: ["SUBMITTED", "PENDING_APPROVAL"],
    },
    approvalSteps: {
      some: {
        status: "PENDING",
        approverUserId: user.id,
      },
    },
  };

  const myAcknowledgementsWhere: Prisma.LeaveRequestWhereInput = {
    organizationId,
    status: "AWAITING_ACKNOWLEDGEMENT",
    acknowledgements: {
      some: {
        status: "PENDING",
        acknowledgerUserId: user.id,
      },
    },
  };

  const managerApprovalsWhere: Prisma.LeaveRequestWhereInput = {
    organizationId,
    status: {
      in: ["SUBMITTED", "PENDING_APPROVAL", "AWAITING_ACKNOWLEDGEMENT"],
    },
    OR: [
      {
        approvalSteps: {
          some: {
            status: "PENDING",
          },
        },
      },
      {
        acknowledgements: {
          some: {
            status: "PENDING",
          },
        },
      },
    ],
  };

  const hrConfirmationsWhere: Prisma.LeaveRequestWhereInput = {
    organizationId,
    status: "MANAGER_APPROVED",
    approvalSteps: {
      some: {
        status: "PENDING",
      },
    },
  };

  const currentlyOnLeaveWhere: Prisma.LeaveRequestWhereInput = {
    organizationId,
    status: "APPROVED",
    startDate: {
      lte: today,
    },
    endDate: {
      gte: today,
    },
  };

  const emptyList: ListRequestRow[] = [];

  const [
    allRequests,
    pendingMyApprovals,
    pendingMyAcknowledgements,
    pendingManagerApprovals,
    pendingHrConfirmations,
    daysTakenAggregate,
    approvedYtdAggregate,
    pendingRequestsCount,
    currentlyOnLeaveRequests,
    pendingMyApprovalCount,
    pendingMyAcknowledgementCount,
    pendingManagerApprovalCount,
    pendingHrConfirmationCount,
    currentlyOnLeavePersonIds,
  ] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        organizationId,
      },
      orderBy: [
        {
          startDate: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: requestLimit,
      select: listRequestSelect,
    }),
    // Assigned manager/final queue (anyone with leave.approve / leave.manage).
    canApprove
      ? prisma.leaveRequest.findMany({
          where: myApprovalsWhere,
          orderBy: [
            {
              submittedAt: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
          take: WORKSPACE_QUEUE_LIMIT,
          select: listRequestSelect,
        })
      : Promise.resolve(emptyList),
    canApprove
      ? prisma.leaveRequest.findMany({
          where: myAcknowledgementsWhere,
          orderBy: [
            {
              submittedAt: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
          take: WORKSPACE_QUEUE_LIMIT,
          select: listRequestSelect,
        })
      : Promise.resolve(emptyList),
    // Org-wide awaiting manager — HR oversight (not assigned to current user).
    canManageLeave
      ? prisma.leaveRequest.findMany({
          where: managerApprovalsWhere,
          orderBy: [
            {
              submittedAt: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
          take: WORKSPACE_QUEUE_LIMIT,
          select: listRequestSelect,
        })
      : Promise.resolve(emptyList),
    canManageLeave
      ? prisma.leaveRequest.findMany({
          where: hrConfirmationsWhere,
          orderBy: [
            {
              submittedAt: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
          take: WORKSPACE_QUEUE_LIMIT,
          select: listRequestSelect,
        })
      : Promise.resolve(emptyList),
    prisma.employeeLeaveBalance.aggregate({
      where: balanceScopeWhere,
      _sum: {
        taken: true,
      },
    }),
    prisma.leaveRequest.aggregate({
      where: {
        ...requestScopeWhere,
        status: "APPROVED",
        approvedAt: {
          gte: yearStart,
        },
      },
      _sum: {
        requestedQuantity: true,
      },
    }),
    prisma.leaveRequest.count({
      where: {
        ...requestScopeWhere,
        status: {
          in: [...awaitingDecisionStatuses],
        },
      },
    }),
    prisma.leaveRequest.findMany({
      where: currentlyOnLeaveWhere,
      orderBy: [
        {
          employee: {
            lastName: "asc",
          },
        },
        {
          employee: {
            firstName: "asc",
          },
        },
        {
          startDate: "asc",
        },
      ],
      take: CURRENTLY_ON_LEAVE_LIMIT,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        leaveType: {
          select: {
            name: true,
            colour: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            employeeNumber: true,
          },
        },
      },
    }),
    canApprove
      ? prisma.leaveRequest.count({ where: myApprovalsWhere })
      : Promise.resolve(0),
    canApprove
      ? prisma.leaveRequest.count({ where: myAcknowledgementsWhere })
      : Promise.resolve(0),
    canManageLeave
      ? prisma.leaveRequest.count({ where: managerApprovalsWhere })
      : Promise.resolve(0),
    canManageLeave
      ? prisma.leaveRequest.count({ where: hrConfirmationsWhere })
      : Promise.resolve(0),
    prisma.leaveRequest.findMany({
      where: currentlyOnLeaveWhere,
      distinct: ["employeeId"],
      select: { employeeId: true },
    }),
  ]);

  const currentlyOnLeave = currentlyOnLeaveRequests.map((request) => ({
    id: request.id,
    startDate: formatDate(request.startDate),
    endDate: formatDate(request.endDate),
    leaveTypeName: request.leaveType.name,
    leaveTypeColour: request.leaveType.colour,
    employeeId: request.employee.id,
    employeeNumber: request.employee.employeeNumber,
    employeeName: `${request.employee.preferredName ?? request.employee.firstName} ${request.employee.lastName}`,
  }));

  const currentlyOnLeavePersonCount = currentlyOnLeavePersonIds.length;

  // For managers who are not HR, "pending approvals" is their assigned queue.
  // For HR, prefer the HR confirmation queue as the primary attention count,
  // and keep assigned-to-me items separate.
  const pendingApprovals = canManageLeave
    ? pendingHrConfirmations
    : pendingMyApprovals;

  return {
    user: {
      id: user.id,
      employeeId: user.employeeId,
      employeeNumber: user.employee?.employeeNumber ?? null,
      employeeName: user.employee
        ? `${user.employee.firstName} ${user.employee.lastName}`
        : `${user.firstName} ${user.lastName}`,
    },
    canApprove,
    canManageLeave,
    statsScope,
    stats: {
      daysTaken: daysTakenAggregate._sum.taken?.toString() ?? "0",
      approvedYtdDays:
        approvedYtdAggregate._sum.requestedQuantity?.toString() ?? "0",
      pendingRequestsCount,
      pendingMyApprovalCount,
      pendingMyAcknowledgementCount,
      pendingHrConfirmationCount,
      pendingManagerApprovalCount,
      currentlyOnLeaveCount: currentlyOnLeavePersonCount,
    },
    currentlyOnLeave,
    allRequests: allRequests.map(serializeRequest),
    pendingApprovals: pendingApprovals.map(serializeRequest),
    pendingMyApprovals: pendingMyApprovals.map(serializeRequest),
    pendingMyAcknowledgements: pendingMyAcknowledgements.map(serializeRequest),
    pendingManagerApprovals: pendingManagerApprovals.map(serializeRequest),
    pendingHrConfirmations: pendingHrConfirmations.map(serializeRequest),
  };
}

export type LeaveWorkspaceData = Awaited<ReturnType<typeof getLeaveWorkspace>>;

export type LeaveRequestSummary = LeaveWorkspaceData["allRequests"][number];

/** Self-service list of the current employee's own leave requests. */
export async function getMyLeaveRequests() {
  const user = await requireCurrentUser();

  if (!user.employeeId) {
    return [];
  }

  const requests = await prisma.leaveRequest.findMany({
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
    take: MY_LEAVE_REQUESTS_LIMIT,
    select: listRequestSelect,
  });

  return requests.map(serializeRequest);
}

export async function getLeaveRequestDetail(leaveRequestId: string) {
  const user = await requireCurrentUser();

  const request = await prisma.leaveRequest.findUnique({
    where: {
      id: leaveRequestId,
    },
    select: {
      ...requestSelect,
      organizationId: true,
      employeeId: true,
      createdByUserId: true,
      attachments: {
        orderBy: {
          uploadedAt: "asc",
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
      },
    },
  });

  if (!request) {
    return null;
  }

  const capabilities = await getUserCapabilities();
  const canManageLeave = capabilities?.can("leave.manage") ?? false;

  const canView =
    canManageLeave ||
    request.employeeId === user.employeeId ||
    request.createdByUserId === user.id ||
    request.approvalSteps.some((step) => step.approverUserId === user.id) ||
    request.acknowledgements.some(
      (item) => item.acknowledgerUserId === user.id,
    );

  if (!canView) {
    return null;
  }

  const pendingStep = request.approvalSteps.find(
    (step) =>
      step.status === "PENDING" &&
      (step.approverUserId === user.id || canManageLeave),
  );

  const isOwner = request.employeeId === user.employeeId;
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const leaveStartUtc = new Date(
    Date.UTC(
      request.startDate.getUTCFullYear(),
      request.startDate.getUTCMonth(),
      request.startDate.getUTCDate(),
    ),
  );
  const awaitingDecision =
    request.status === "SUBMITTED" ||
    request.status === "AWAITING_ACKNOWLEDGEMENT" ||
    request.status === "PENDING_APPROVAL" ||
    request.status === "MANAGER_APPROVED";
  const awaitingApprovalDecision =
    request.status === "SUBMITTED" ||
    request.status === "PENDING_APPROVAL" ||
    request.status === "MANAGER_APPROVED";

  const pendingAck = request.acknowledgements.find(
    (item) =>
      item.status === "PENDING" &&
      (item.acknowledgerUserId === user.id || canManageLeave),
  );

  return {
    ...serializeRequest(request),
    attachments: request.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      uploadedAt: attachment.uploadedAt.toISOString(),
      viewUrl: `/people/leave/${request.id}/attachments/${attachment.id}?disposition=inline`,
      downloadUrl: `/people/leave/${request.id}/attachments/${attachment.id}?disposition=attachment`,
    })),
    decisionMode:
      request.status === "MANAGER_APPROVED" && canManageLeave
        ? ("hr" as const)
        : ("manager" as const),
    canDecide:
      Boolean(pendingStep) &&
      awaitingApprovalDecision &&
      (pendingStep?.approverUserId === user.id || canManageLeave),
    canAcknowledge:
      request.status === "AWAITING_ACKNOWLEDGEMENT" &&
      Boolean(pendingAck) &&
      (pendingAck?.acknowledgerUserId === user.id || canManageLeave),
    canWithdraw: isOwner && awaitingDecision,
    canCancel:
      isOwner && request.status === "APPROVED" && leaveStartUtc > todayUtc,
    isOwner,
  };
}

export type LeaveRequestDetail = NonNullable<
  Awaited<ReturnType<typeof getLeaveRequestDetail>>
>;
