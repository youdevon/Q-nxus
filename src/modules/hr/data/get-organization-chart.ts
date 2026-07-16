import { prisma } from "@/lib/prisma";

export type OrganizationChartPosition = {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  departmentId: string;
  departmentName: string;
  reportsToPositionId: string | null;
  isActive: boolean;
  holders: {
    assignmentId: string;
    employeeId: string;
    employeeNumber: string;
    employeeName: string;
    preferredName: string | null;
    isActing: boolean;
    assignmentType: string;
    startDate: string;
  }[];
  directReports: OrganizationChartPosition[];
};

export type OrganizationChartData = {
  organization: {
    id: string;
    name: string;
  };
  rootPositions: OrganizationChartPosition[];
  unassignedPositions: OrganizationChartPosition[];
  totals: {
    departments: number;
    positions: number;
    occupiedPositions: number;
    vacantPositions: number;
    actingAssignments: number;
  };
};

type FlatPosition = Omit<OrganizationChartPosition, "directReports"> & {
  directReports: OrganizationChartPosition[];
};

export async function getOrganizationChart(): Promise<OrganizationChartData | null> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      name: true,
      departments: {
        where: {
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          positions: {
            orderBy: [
              {
                title: "asc",
              },
              {
                createdAt: "asc",
              },
            ],
            select: {
              id: true,
              title: true,
              code: true,
              description: true,
              departmentId: true,
              reportsToPositionId: true,
              isActive: true,
              assignments: {
                where: {
                  isCurrent: true,
                },
                orderBy: [
                  {
                    isActing: "desc",
                  },
                  {
                    startDate: "asc",
                  },
                ],
                select: {
                  id: true,
                  assignmentType: true,
                  isActing: true,
                  startDate: true,
                  employee: {
                    select: {
                      id: true,
                      employeeNumber: true,
                      firstName: true,
                      lastName: true,
                      preferredName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  const flatPositions: FlatPosition[] = organization.departments.flatMap(
    (department) =>
      department.positions.map((position) => ({
        id: position.id,
        title: position.title,
        code: position.code,
        description: position.description,
        departmentId: position.departmentId,
        departmentName: department.name,
        reportsToPositionId: position.reportsToPositionId,
        isActive: position.isActive,
        holders: position.assignments.map((assignment) => ({
          assignmentId: assignment.id,
          employeeId: assignment.employee.id,
          employeeNumber: assignment.employee.employeeNumber,
          employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
          preferredName: assignment.employee.preferredName,
          isActing: assignment.isActing,
          assignmentType: assignment.assignmentType,
          startDate: assignment.startDate.toISOString().slice(0, 10),
        })),
        directReports: [],
      })),
  );

  const positionMap = new Map(
    flatPositions.map((position) => [position.id, position]),
  );

  const rootPositions: OrganizationChartPosition[] = [];
  const unassignedPositions: OrganizationChartPosition[] = [];

  for (const position of flatPositions) {
    if (!position.reportsToPositionId) {
      rootPositions.push(position);
      continue;
    }

    const parent = positionMap.get(position.reportsToPositionId);

    if (!parent) {
      unassignedPositions.push(position);
      continue;
    }

    parent.directReports.push(position);
  }

  function sortHierarchy(positions: OrganizationChartPosition[]) {
    positions.sort((left, right) => left.title.localeCompare(right.title));

    for (const position of positions) {
      sortHierarchy(position.directReports);
    }
  }

  sortHierarchy(rootPositions);
  sortHierarchy(unassignedPositions);

  const occupiedPositions = flatPositions.filter(
    (position) => position.holders.length > 0,
  ).length;

  return {
    organization: {
      id: organization.id,
      name: organization.name,
    },
    rootPositions,
    unassignedPositions,
    totals: {
      departments: organization.departments.length,
      positions: flatPositions.length,
      occupiedPositions,
      vacantPositions: flatPositions.length - occupiedPositions,
      actingAssignments: flatPositions.reduce(
        (total, position) =>
          total + position.holders.filter((holder) => holder.isActing).length,
        0,
      ),
    },
  };
}

export type PositionReportingEditorData = {
  position: {
    id: string;
    title: string;
    code: string | null;
    departmentId: string;
    departmentName: string;
    reportsToPositionId: string | null;
    updatedAt: string;
  };
  availableManagers: {
    id: string;
    title: string;
    code: string | null;
    departmentName: string;
    currentHolderNames: string[];
  }[];
};

async function collectDescendantPositionIds(
  positionId: string,
): Promise<Set<string>> {
  const positions = await prisma.position.findMany({
    select: {
      id: true,
      reportsToPositionId: true,
    },
  });

  const childrenByParent = new Map<string, string[]>();

  for (const position of positions) {
    if (!position.reportsToPositionId) {
      continue;
    }

    const children = childrenByParent.get(position.reportsToPositionId) ?? [];

    children.push(position.id);

    childrenByParent.set(position.reportsToPositionId, children);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(positionId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (descendants.has(current)) {
      continue;
    }

    descendants.add(current);

    queue.push(...(childrenByParent.get(current) ?? []));
  }

  return descendants;
}

export async function getPositionReportingEditorData(
  positionId: string,
): Promise<PositionReportingEditorData | null> {
  const position = await prisma.position.findUnique({
    where: {
      id: positionId,
    },
    select: {
      id: true,
      title: true,
      code: true,
      departmentId: true,
      reportsToPositionId: true,
      updatedAt: true,
      department: {
        select: {
          name: true,
          organizationId: true,
        },
      },
    },
  });

  if (!position) {
    return null;
  }

  const descendantIds = await collectDescendantPositionIds(position.id);

  const excludedIds = new Set([position.id, ...descendantIds]);

  const managers = await prisma.position.findMany({
    where: {
      department: {
        organizationId: position.department.organizationId,
      },
      isActive: true,
      id: {
        notIn: [...excludedIds],
      },
    },
    orderBy: [
      {
        department: {
          name: "asc",
        },
      },
      {
        title: "asc",
      },
    ],
    select: {
      id: true,
      title: true,
      code: true,
      department: {
        select: {
          name: true,
        },
      },
      assignments: {
        where: {
          isCurrent: true,
        },
        select: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return {
    position: {
      id: position.id,
      title: position.title,
      code: position.code,
      departmentId: position.departmentId,
      departmentName: position.department.name,
      reportsToPositionId: position.reportsToPositionId,
      updatedAt: position.updatedAt.toISOString(),
    },
    availableManagers: managers.map((manager) => ({
      id: manager.id,
      title: manager.title,
      code: manager.code,
      departmentName: manager.department.name,
      currentHolderNames: manager.assignments.map(
        (assignment) =>
          `${assignment.employee.firstName} ${assignment.employee.lastName}`,
      ),
    })),
  };
}
