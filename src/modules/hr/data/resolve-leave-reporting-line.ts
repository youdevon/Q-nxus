import { prisma } from "@/lib/prisma";
import {
  resolveAcknowledgementChain,
  type ReportingLineHolder,
  type ReportingLineNode,
  type ReportingLinePosition,
} from "@/src/modules/hr/lib/leave-reporting-line";

type PositionHolderRow = {
  isActing: boolean;
  startDate: Date;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
    } | null;
  };
};

function pickHolder(
  assignmentHolders: PositionHolderRow[],
  employeeHolders: Array<{
    id: string;
    firstName: string;
    lastName: string;
    user: PositionHolderRow["employee"]["user"];
  }>,
): ReportingLineHolder | null {
  const combined: Array<{
    isActing: boolean;
    employee: PositionHolderRow["employee"];
  }> = [
    ...assignmentHolders.map((item) => ({
      isActing: item.isActing,
      employee: item.employee,
    })),
    ...employeeHolders
      .filter(
        (holder) =>
          !assignmentHolders.some(
            (assigned) => assigned.employee.id === holder.id,
          ),
      )
      .map((holder) => ({
        isActing: false,
        employee: holder,
      })),
  ];

  if (combined.length === 0) {
    return null;
  }

  const withActiveUser = combined.find(
    (holder) => holder.employee.user?.isActive,
  );
  const chosen = withActiveUser ?? combined[0]!;
  const user = chosen.employee.user?.isActive ? chosen.employee.user : null;

  return {
    positionId: "",
    employeeId: chosen.employee.id,
    employeeName: `${chosen.employee.firstName} ${chosen.employee.lastName}`,
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    userName: user
      ? `${user.firstName} ${user.lastName}`
      : null,
  };
}

export type ResolvedFinalApprover = {
  positionId: string;
  positionTitle: string;
  employeeId: string | null;
  employeeName: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  issue:
    | null
    | "POSITION_NOT_FOUND"
    | "POSITION_VACANT"
    | "USER_MISSING";
};

export async function resolveFinalApproverByPosition(
  positionId: string,
): Promise<ResolvedFinalApprover | null> {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: {
      id: true,
      title: true,
      assignments: {
        where: { isCurrent: true },
        orderBy: [{ isActing: "desc" }, { startDate: "desc" }],
        select: {
          isActing: true,
          startDate: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
      employees: {
        where: {
          isArchived: false,
          employmentStatus: { in: ["ACTIVE", "ON_LEAVE", "SUSPENDED"] },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!position) {
    return {
      positionId,
      positionTitle: "",
      employeeId: null,
      employeeName: null,
      userId: null,
      userEmail: null,
      userName: null,
      issue: "POSITION_NOT_FOUND",
    };
  }

  const holder = pickHolder(position.assignments, position.employees);

  if (!holder) {
    return {
      positionId: position.id,
      positionTitle: position.title,
      employeeId: null,
      employeeName: null,
      userId: null,
      userEmail: null,
      userName: null,
      issue: "POSITION_VACANT",
    };
  }

  return {
    positionId: position.id,
    positionTitle: position.title,
    employeeId: holder.employeeId,
    employeeName: holder.employeeName,
    userId: holder.userId,
    userEmail: holder.userEmail,
    userName: holder.userName,
    issue: holder.userId ? null : "USER_MISSING",
  };
}

export type ResolvedLeaveReportingLine = {
  requesterPositionId: string;
  requesterPositionTitle: string;
  finalApprover: ResolvedFinalApprover;
  acknowledgementChain: ReportingLineNode[];
  issue:
    | null
    | "NO_POSITION"
    | "FINAL_NOT_CONFIGURED"
    | "FINAL_NOT_IN_LINE"
    | "MISSING_ACK_USER"
    | "FINAL_USER_MISSING"
    | "FINAL_POSITION_VACANT"
    | "FINAL_POSITION_NOT_FOUND";
};

export async function resolveLeaveReportingLine(input: {
  employeeId: string;
  organizationId: string;
  finalApproverPositionId: string;
}): Promise<ResolvedLeaveReportingLine> {
  const [employee, positions, finalApprover] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true,
        positionId: true,
        position: { select: { id: true, title: true } },
        assignments: {
          where: { isCurrent: true, positionId: { not: null } },
          orderBy: [{ isActing: "desc" }, { startDate: "desc" }],
          take: 1,
          select: {
            position: { select: { id: true, title: true } },
          },
        },
      },
    }),
    prisma.position.findMany({
      where: {
        department: { organizationId: input.organizationId },
      },
      select: {
        id: true,
        title: true,
        reportsToPositionId: true,
        assignments: {
          where: { isCurrent: true },
          orderBy: [{ isActing: "desc" }, { startDate: "desc" }],
          select: {
            isActing: true,
            startDate: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        employees: {
          where: {
            isArchived: false,
            employmentStatus: { in: ["ACTIVE", "ON_LEAVE", "SUSPENDED"] },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
              },
            },
          },
        },
      },
    }),
    resolveFinalApproverByPosition(input.finalApproverPositionId),
  ]);

  const requesterPosition =
    employee?.assignments[0]?.position ?? employee?.position ?? null;

  if (!employee || !requesterPosition) {
    return {
      requesterPositionId: "",
      requesterPositionTitle: "",
      finalApprover: finalApprover ?? {
        positionId: input.finalApproverPositionId,
        positionTitle: "",
        employeeId: null,
        employeeName: null,
        userId: null,
        userEmail: null,
        userName: null,
        issue: "POSITION_NOT_FOUND",
      },
      acknowledgementChain: [],
      issue: "NO_POSITION",
    };
  }

  if (!finalApprover || finalApprover.issue === "POSITION_NOT_FOUND") {
    return {
      requesterPositionId: requesterPosition.id,
      requesterPositionTitle: requesterPosition.title,
      finalApprover: finalApprover ?? {
        positionId: input.finalApproverPositionId,
        positionTitle: "",
        employeeId: null,
        employeeName: null,
        userId: null,
        userEmail: null,
        userName: null,
        issue: "POSITION_NOT_FOUND",
      },
      acknowledgementChain: [],
      issue: "FINAL_POSITION_NOT_FOUND",
    };
  }

  if (finalApprover.issue === "POSITION_VACANT") {
    return {
      requesterPositionId: requesterPosition.id,
      requesterPositionTitle: requesterPosition.title,
      finalApprover,
      acknowledgementChain: [],
      issue: "FINAL_POSITION_VACANT",
    };
  }

  if (finalApprover.issue === "USER_MISSING" || !finalApprover.userId) {
    return {
      requesterPositionId: requesterPosition.id,
      requesterPositionTitle: requesterPosition.title,
      finalApprover,
      acknowledgementChain: [],
      issue: "FINAL_USER_MISSING",
    };
  }

  const positionsById = new Map<string, ReportingLinePosition>();
  const holdersByPositionId = new Map<string, ReportingLineHolder>();

  for (const position of positions) {
    positionsById.set(position.id, {
      id: position.id,
      title: position.title,
      reportsToPositionId: position.reportsToPositionId,
    });

    const holder = pickHolder(position.assignments, position.employees);

    if (holder) {
      holdersByPositionId.set(position.id, {
        ...holder,
        positionId: position.id,
      });
    }
  }

  const resolved = resolveAcknowledgementChain({
    requesterPositionId: requesterPosition.id,
    finalApproverPositionId: input.finalApproverPositionId,
    positionsById,
    holdersByPositionId,
    excludeEmployeeId: employee.id,
  });

  if (!resolved.reachedFinalApprover) {
    return {
      requesterPositionId: requesterPosition.id,
      requesterPositionTitle: requesterPosition.title,
      finalApprover,
      acknowledgementChain: [],
      issue: "FINAL_NOT_IN_LINE",
    };
  }

  const missingAckUser = resolved.chain.some((node) => !node.userId);

  return {
    requesterPositionId: requesterPosition.id,
    requesterPositionTitle: requesterPosition.title,
    finalApprover,
    acknowledgementChain: resolved.chain,
    issue: missingAckUser ? "MISSING_ACK_USER" : null,
  };
}

export function describeLeaveReportingLineIssue(
  line: ResolvedLeaveReportingLine,
): string {
  switch (line.issue) {
    case "NO_POSITION":
      return "You must be assigned to a position before leave can be submitted.";
    case "FINAL_NOT_CONFIGURED":
      return "Leave workflow requires a final approver position. Configure it under People → Leave workflow.";
    case "FINAL_POSITION_NOT_FOUND":
      return "The configured final leave approver position could not be found.";
    case "FINAL_POSITION_VACANT":
      return `The final approver position (${line.finalApprover.positionTitle || "configured position"}) has no assigned employee.`;
    case "FINAL_USER_MISSING":
      return `The final approver (${line.finalApprover.employeeName ?? line.finalApprover.positionTitle}) does not have a linked user account.`;
    case "FINAL_NOT_IN_LINE":
      return `Your position (${line.requesterPositionTitle}) does not report up to the final approver position (${line.finalApprover.positionTitle}). Update reporting lines under People → Organization.`;
    case "MISSING_ACK_USER":
      return "Someone in your reporting line does not have a linked user account, so leave acknowledgements cannot be assigned.";
    default:
      return "The leave reporting line could not be resolved.";
  }
}
