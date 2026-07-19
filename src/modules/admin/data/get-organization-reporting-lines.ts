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

/** Lightweight row for the organization page reporting preview (no holders). */
export type OrganizationReportingLinesPreviewPosition = {
  id: string;
  title: string;
  code: string | null;
  departmentName: string;
  reportsToTitle: string | null;
};

export type OrganizationReportingLinesPreviewData = {
  positions: OrganizationReportingLinesPreviewPosition[];
  totals: {
    positions: number;
    withReportingLine: number;
  };
};

const REPORTING_LINES_PREVIEW_LIMIT = 8;

function positionsInActiveDepartmentsWhere(organizationId: string) {
  return {
    department: {
      organizationId,
      isActive: true,
    },
  };
}

const organizationReportingSelect = {
  id: true,
  name: true,
  code: true,
  departments: {
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc" as const,
    },
    select: {
      id: true,
      name: true,
      positions: {
        orderBy: [
          {
            title: "asc" as const,
          },
          {
            createdAt: "asc" as const,
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
};

function mapOrganizationReportingLines(
  organization: {
    id: string;
    name: string;
    code: string;
    departments: Array<{
      id: string;
      name: string;
      positions: Array<{
        id: string;
        title: string;
        code: string | null;
        departmentId: string;
        reportsToPositionId: string | null;
        isActive: boolean;
        updatedAt: Date;
        reportsToPosition: { title: string } | null;
        assignments: Array<{
          employee: { firstName: string; lastName: string };
        }>;
      }>;
    }>;
  },
): OrganizationReportingLinesData {
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

export async function getOrganizationReportingLines(
  organizationId?: string,
): Promise<OrganizationReportingLinesData | null> {
  const organization = organizationId
    ? await prisma.organization.findUnique({
        where: { id: organizationId },
        select: organizationReportingSelect,
      })
    : await prisma.organization.findFirst({
        orderBy: {
          createdAt: "asc",
        },
        select: organizationReportingSelect,
      });

  if (!organization) {
    return null;
  }

  return mapOrganizationReportingLines(organization);
}

/**
 * Light loader for the organization profile page: ~8 preview rows plus
 * totals only. Does not load assignments, holders, or manager options.
 */
export async function getOrganizationReportingLinesPreview(
  organizationId?: string,
): Promise<OrganizationReportingLinesPreviewData | null> {
  const resolvedOrganizationId =
    organizationId ??
    (
      await prisma.organization.findFirst({
        orderBy: {
          createdAt: "asc",
        },
        select: { id: true },
      })
    )?.id;

  if (!resolvedOrganizationId) {
    return null;
  }

  const positionWhere = positionsInActiveDepartmentsWhere(
    resolvedOrganizationId,
  );

  const [previewRows, totalPositions, withReportingLine] = await Promise.all([
    prisma.position.findMany({
      where: positionWhere,
      orderBy: [
        { department: { name: "asc" } },
        { title: "asc" },
        { createdAt: "asc" },
      ],
      take: REPORTING_LINES_PREVIEW_LIMIT,
      select: {
        id: true,
        title: true,
        code: true,
        department: {
          select: {
            name: true,
          },
        },
        reportsToPosition: {
          select: {
            title: true,
          },
        },
      },
    }),
    prisma.position.count({ where: positionWhere }),
    prisma.position.count({
      where: {
        ...positionWhere,
        reportsToPositionId: { not: null },
      },
    }),
  ]);

  return {
    positions: previewRows.map((position) => ({
      id: position.id,
      title: position.title,
      code: position.code,
      departmentName: position.department.name,
      reportsToTitle: position.reportsToPosition?.title ?? null,
    })),
    totals: {
      positions: totalPositions,
      withReportingLine,
    },
  };
}
