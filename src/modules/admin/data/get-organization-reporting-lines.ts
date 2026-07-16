import { prisma } from "@/lib/prisma";

export type OrganizationReportingLinePosition = {
  id: string;
  title: string;
  code: string | null;
  departmentId: string;
  departmentName: string;
  reportsToPositionId: string | null;
  reportsToTitle: string | null;
  isActive: boolean;
  updatedAt: string;
  holderNames: string[];
};

export type OrganizationReportingLinesData = {
  organization: {
    id: string;
    name: string;
    code: string;
  };
  positions: OrganizationReportingLinePosition[];
  managerOptions: {
    id: string;
    title: string;
    code: string | null;
    departmentName: string;
    holderNames: string[];
  }[];
  totals: {
    positions: number;
    withReportingLine: number;
    topLevel: number;
  };
};

export async function getOrganizationReportingLines(): Promise<OrganizationReportingLinesData | null> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      name: true,
      code: true,
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
              departmentId: true,
              reportsToPositionId: true,
              isActive: true,
              updatedAt: true,
              reportsToPosition: {
                select: {
                  title: true,
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
          },
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  const positions: OrganizationReportingLinePosition[] =
    organization.departments.flatMap((department) =>
      department.positions.map((position) => ({
        id: position.id,
        title: position.title,
        code: position.code,
        departmentId: position.departmentId,
        departmentName: department.name,
        reportsToPositionId: position.reportsToPositionId,
        reportsToTitle: position.reportsToPosition?.title ?? null,
        isActive: position.isActive,
        updatedAt: position.updatedAt.toISOString(),
        holderNames: position.assignments.map(
          (assignment) =>
            `${assignment.employee.firstName} ${assignment.employee.lastName}`,
        ),
      })),
    );

  const withReportingLine = positions.filter(
    (position) => position.reportsToPositionId,
  ).length;

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      code: organization.code,
    },
    positions,
    managerOptions: positions
      .filter((position) => position.isActive)
      .map((position) => ({
        id: position.id,
        title: position.title,
        code: position.code,
        departmentName: position.departmentName,
        holderNames: position.holderNames,
      })),
    totals: {
      positions: positions.length,
      withReportingLine,
      topLevel: positions.length - withReportingLine,
    },
  };
}
