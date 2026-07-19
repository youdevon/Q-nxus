import { prisma } from "@/lib/prisma";

export type DirectReportSummary = {
  employeeId: string;
  employeeNumber: string;
  displayName: string;
  departmentName: string | null;
  positionTitle: string | null;
  managerVisibleLetterCount: number;
};

type SupervisorHolder = {
  isActing: boolean;
  employeeId: string;
  hasActiveUser: boolean;
};

function pickSupervisorEmployeeId(holders: SupervisorHolder[]): string | null {
  if (holders.length === 0) {
    return null;
  }

  const withActiveUser = holders.find((holder) => holder.hasActiveUser);
  return (withActiveUser ?? holders[0])?.employeeId ?? null;
}

/**
 * Employees for whom `supervisorEmployeeId` is the resolved reporting officer.
 * Uses the same supervisor resolution rules as leave / correspondence access,
 * but resolves the org graph in bulk (no per-employee N+1).
 */
export async function getDirectReportsForSupervisor(
  supervisorEmployeeId: string,
): Promise<DirectReportSummary[]> {
  const candidates = await prisma.employee.findMany({
    where: {
      isArchived: false,
      employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] },
      id: { not: supervisorEmployeeId },
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      position: {
        select: {
          id: true,
          title: true,
          reportsToPositionId: true,
        },
      },
      assignments: {
        where: {
          isCurrent: true,
          positionId: { not: null },
        },
        orderBy: [{ isActing: "desc" }, { startDate: "desc" }],
        take: 1,
        select: {
          position: {
            select: {
              id: true,
              title: true,
              reportsToPositionId: true,
            },
          },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const candidatePositions = candidates.map((candidate) => {
    const position = candidate.assignments[0]?.position ?? candidate.position;
    return {
      candidate,
      positionTitle: position?.title ?? null,
      reportsToPositionId: position?.reportsToPositionId ?? null,
    };
  });

  const supervisorPositionIds = [
    ...new Set(
      candidatePositions
        .map((row) => row.reportsToPositionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (supervisorPositionIds.length === 0) {
    return [];
  }

  const supervisorPositions = await prisma.position.findMany({
    where: { id: { in: supervisorPositionIds } },
    select: {
      id: true,
      assignments: {
        where: { isCurrent: true },
        orderBy: [{ isActing: "desc" }, { startDate: "desc" }],
        select: {
          isActing: true,
          employee: {
            select: {
              id: true,
              user: { select: { isActive: true } },
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
          user: { select: { isActive: true } },
        },
      },
    },
  });

  const supervisorByPositionId = new Map<string, string | null>();
  for (const position of supervisorPositions) {
    const assignmentHolders: SupervisorHolder[] = position.assignments.map(
      (item) => ({
        isActing: item.isActing,
        employeeId: item.employee.id,
        hasActiveUser: Boolean(item.employee.user?.isActive),
      }),
    );
    const assignedIds = new Set(
      assignmentHolders.map((holder) => holder.employeeId),
    );
    const employeeHolders: SupervisorHolder[] = position.employees
      .filter((holder) => !assignedIds.has(holder.id))
      .map((holder) => ({
        isActing: false,
        employeeId: holder.id,
        hasActiveUser: Boolean(holder.user?.isActive),
      }));

    supervisorByPositionId.set(
      position.id,
      pickSupervisorEmployeeId([...assignmentHolders, ...employeeHolders]),
    );
  }

  const reportRows = candidatePositions.filter((row) => {
    if (!row.reportsToPositionId) {
      return false;
    }
    return (
      supervisorByPositionId.get(row.reportsToPositionId) ===
      supervisorEmployeeId
    );
  });

  if (reportRows.length === 0) {
    return [];
  }

  const reportIds = reportRows.map((row) => row.candidate.id);
  const letterCounts = await prisma.employeeCorrespondence.groupBy({
    by: ["employeeId"],
    where: {
      employeeId: { in: reportIds },
      managerVisible: true,
      status: { in: ["ISSUED", "ACKNOWLEDGED"] },
    },
    _count: { _all: true },
  });
  const letterCountByEmployee = new Map(
    letterCounts.map((row) => [row.employeeId, row._count._all]),
  );

  return reportRows.map(({ candidate, positionTitle }) => ({
    employeeId: candidate.id,
    employeeNumber: candidate.employeeNumber,
    displayName: `${candidate.firstName} ${candidate.lastName}`,
    departmentName: candidate.department?.name ?? null,
    positionTitle,
    managerVisibleLetterCount: letterCountByEmployee.get(candidate.id) ?? 0,
  }));
}

export type TeamDocumentLetter = {
  id: string;
  title: string;
  category: string;
  status: string;
  issueDate: string | null;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  detailHref: string;
};

export async function getTeamManagerVisibleLetters(
  supervisorEmployeeId: string,
): Promise<{
  reports: DirectReportSummary[];
  letters: TeamDocumentLetter[];
}> {
  const reports = await getDirectReportsForSupervisor(supervisorEmployeeId);
  const reportIds = reports.map((report) => report.employeeId);

  if (reportIds.length === 0) {
    return { reports, letters: [] };
  }

  const letters = await prisma.employeeCorrespondence.findMany({
    where: {
      employeeId: { in: reportIds },
      managerVisible: true,
      status: { in: ["ISSUED", "ACKNOWLEDGED"] },
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      issueDate: true,
      employeeId: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
    },
  });

  return {
    reports,
    letters: letters.map((letter) => ({
      id: letter.id,
      title: letter.title,
      category: letter.category,
      status: letter.status,
      issueDate: letter.issueDate?.toISOString().slice(0, 10) ?? null,
      employeeId: letter.employeeId,
      employeeName: `${letter.employee.firstName} ${letter.employee.lastName}`,
      employeeNumber: letter.employee.employeeNumber,
      detailHref: `/people/employees/${letter.employeeId}/documents/${letter.id}`,
    })),
  };
}
