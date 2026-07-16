import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";

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
  };
  finalDecisionBy: {
    firstName: string;
    lastName: string;
  } | null;
  approvalSteps: {
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
      approverPositionTitle: step.approverPosition?.title ?? null,
      approverName: step.approverUser
        ? `${step.approverUser.firstName} ${step.approverUser.lastName}`
        : null,
      approverEmail: step.approverUser?.email ?? null,
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
} as const;

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
  "PENDING_APPROVAL",
  "MANAGER_APPROVED",
] as const;

export async function getLeaveWorkspace() {
  const user = await requireCurrentUser();
  const capabilities = await getUserCapabilities(user.id);
  const canManageLeave = capabilities?.can("leave.manage") ?? false;
  const canApprove =
    (capabilities?.can("leave.approve") ?? false) || canManageLeave;
  const canViewOrgStats =
    capabilities?.canAny("leave.manage", "people.directory.view") ?? false;

  if (!user.employeeId && !canApprove && !canManageLeave) {
    throw new Error("Your user account is not linked to an employee record.");
  }

  // Approvers/HR without an employee link still need org queues.
  const statsScope =
    canViewOrgStats || !user.employeeId ? "org" : "self";
  const yearStart = currentYearStartUtc();
  const today = todayUtcDate();
  const organizationId =
    user.employee?.organizationId ?? user.organizationId;
  const balanceScopeWhere = currentContractBalanceWhere(
    statsScope,
    organizationId,
    user.employeeId,
  );
  const requestScopeWhere = leaveRequestScopeWhere(
    statsScope,
    organizationId,
    user.employeeId,
  );

  const [
    myRequests,
    pendingMyApprovals,
    pendingManagerApprovals,
    pendingHrConfirmations,
    daysTakenAggregate,
    approvedYtdAggregate,
    pendingRequestsCount,
    currentlyOnLeaveRequests,
  ] = await Promise.all([
    user.employeeId
      ? prisma.leaveRequest.findMany({
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
        })
      : Promise.resolve([]),
    // Assigned manager queue (anyone with leave.approve / leave.manage).
    canApprove
      ? prisma.leaveRequest.findMany({
          where: {
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
        })
      : Promise.resolve([]),
    // Org-wide awaiting manager — HR oversight (not assigned to current user).
    canManageLeave
      ? prisma.leaveRequest.findMany({
          where: {
            organizationId,
            status: {
              in: ["SUBMITTED", "PENDING_APPROVAL"],
            },
            approvalSteps: {
              some: {
                status: "PENDING",
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
        })
      : Promise.resolve([]),
    canManageLeave
      ? prisma.leaveRequest.findMany({
          where: {
            organizationId,
            status: "MANAGER_APPROVED",
            approvalSteps: {
              some: {
                status: "PENDING",
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
        })
      : Promise.resolve([]),
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
      where: {
        organizationId,
        status: "APPROVED",
        startDate: {
          lte: today,
        },
        endDate: {
          gte: today,
        },
      },
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

  const currentlyOnLeavePersonCount = new Set(
    currentlyOnLeave.map((item) => item.employeeId),
  ).size;

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
      pendingMyApprovalCount: pendingMyApprovals.length,
      pendingHrConfirmationCount: pendingHrConfirmations.length,
      pendingManagerApprovalCount: pendingManagerApprovals.length,
      currentlyOnLeaveCount: currentlyOnLeavePersonCount,
    },
    currentlyOnLeave,
    myRequests: myRequests.map(serializeRequest),
    pendingApprovals: pendingApprovals.map(serializeRequest),
    pendingMyApprovals: pendingMyApprovals.map(serializeRequest),
    pendingManagerApprovals: pendingManagerApprovals.map(serializeRequest),
    pendingHrConfirmations: pendingHrConfirmations.map(serializeRequest),
  };
}

export type LeaveWorkspaceData = Awaited<ReturnType<typeof getLeaveWorkspace>>;

export type LeaveRequestSummary = LeaveWorkspaceData["myRequests"][number];

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

  const capabilities = await getUserCapabilities(user.id);
  const canManageLeave = capabilities?.can("leave.manage") ?? false;

  const canView =
    canManageLeave ||
    request.employeeId === user.employeeId ||
    request.createdByUserId === user.id ||
    request.approvalSteps.some((step) => step.approverUserId === user.id);

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
    request.status === "PENDING_APPROVAL" ||
    request.status === "MANAGER_APPROVED";

  return {
    ...serializeRequest(request),
    attachments: request.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      uploadedAt: attachment.uploadedAt.toISOString(),
      viewUrl: `/leave/${request.id}/attachments/${attachment.id}?disposition=inline`,
      downloadUrl: `/leave/${request.id}/attachments/${attachment.id}?disposition=attachment`,
    })),
    decisionMode:
      request.status === "MANAGER_APPROVED" && canManageLeave
        ? ("hr" as const)
        : ("manager" as const),
    canDecide:
      Boolean(pendingStep) &&
      awaitingDecision &&
      (pendingStep?.approverUserId === user.id || canManageLeave),
    canWithdraw: isOwner && awaitingDecision,
    canCancel:
      isOwner && request.status === "APPROVED" && leaveStartUtc > todayUtc,
    isOwner,
  };
}

export type LeaveRequestDetail = NonNullable<
  Awaited<ReturnType<typeof getLeaveRequestDetail>>
>;
