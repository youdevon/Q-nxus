import { prisma } from "@/lib/prisma";
import { isAcknowledgementOverdue } from "@/src/modules/hr/lib/correspondence-visibility";

export type CorrespondenceTemplateListItem = {
  id: string;
  name: string;
  category: string;
  defaultTitle: string;
  employeeVisible: boolean;
  requiresAcknowledgement: boolean;
  allowsEmployeeResponse: boolean;
  isActive: boolean;
  updatedAt: string;
};

export type CorrespondenceTemplateDetail = CorrespondenceTemplateListItem & {
  body: string;
  createdAt: string;
};

export async function getCorrespondenceTemplates(
  organizationId: string,
  options?: { activeOnly?: boolean },
): Promise<CorrespondenceTemplateListItem[]> {
  const records = await prisma.correspondenceTemplate.findMany({
    where: {
      organizationId,
      ...(options?.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      defaultTitle: true,
      body: true,
      employeeVisible: true,
      requiresAcknowledgement: true,
      allowsEmployeeResponse: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return records.map((record) => ({
    id: record.id,
    name: record.name,
    category: record.category,
    defaultTitle: record.defaultTitle,
    employeeVisible: record.employeeVisible,
    requiresAcknowledgement: record.requiresAcknowledgement,
    allowsEmployeeResponse: record.allowsEmployeeResponse,
    isActive: record.isActive,
    updatedAt: record.updatedAt.toISOString(),
  }));
}

export async function getCorrespondenceTemplateDetail(
  organizationId: string,
  templateId: string,
): Promise<CorrespondenceTemplateDetail | null> {
  const record = await prisma.correspondenceTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: {
      id: true,
      name: true,
      category: true,
      defaultTitle: true,
      body: true,
      employeeVisible: true,
      requiresAcknowledgement: true,
      allowsEmployeeResponse: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    category: record.category,
    defaultTitle: record.defaultTitle,
    body: record.body,
    employeeVisible: record.employeeVisible,
    requiresAcknowledgement: record.requiresAcknowledgement,
    allowsEmployeeResponse: record.allowsEmployeeResponse,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type OrgCorrespondenceSearchFilters = {
  query?: string;
  category?: string;
  status?: string;
  subType?: string;
  overdueAck?: boolean;
  expiringRetention?: boolean;
  /** Letters whose retentionUntil is already past (still ISSUED/ACKNOWLEDGED). */
  pastRetention?: boolean;
  issueFrom?: string;
  issueTo?: string;
};

export type OrgCorrespondenceSearchItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  category: string;
  subType: string | null;
  title: string;
  status: string;
  issueDate: string | null;
  effectiveDate: string;
  requiresAcknowledgement: boolean;
  isAckOverdue: boolean;
  retentionUntil: string | null;
  detailHref: string;
};

export type OrgCorrespondenceSearchResult = {
  items: OrgCorrespondenceSearchItem[];
  total: number;
};

export async function searchOrgCorrespondence(
  organizationId: string,
  filters: OrgCorrespondenceSearchFilters = {},
): Promise<OrgCorrespondenceSearchResult> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const retentionWindow = new Date(today);
  retentionWindow.setUTCDate(retentionWindow.getUTCDate() + 30);

  const issueFrom = filters.issueFrom
    ? new Date(`${filters.issueFrom}T00:00:00.000Z`)
    : undefined;
  const issueTo = filters.issueTo
    ? new Date(`${filters.issueTo}T23:59:59.999Z`)
    : undefined;

  const records = await prisma.employeeCorrespondence.findMany({
    where: {
      organizationId,
      ...(filters.category ? { category: filters.category as never } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.subType
        ? { subType: { equals: filters.subType, mode: "insensitive" } }
        : {}),
      ...(filters.overdueAck
        ? {
            status: "ISSUED",
            requiresAcknowledgement: true,
            issueDate: {
              not: null,
              lt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
            },
          }
        : {}),
      ...(filters.expiringRetention
        ? {
            retentionUntil: {
              not: null,
              gte: today,
              lte: retentionWindow,
            },
            status: { in: ["ISSUED", "ACKNOWLEDGED"] },
          }
        : {}),
      ...(filters.pastRetention
        ? {
            retentionUntil: {
              not: null,
              lt: today,
            },
            status: { in: ["ISSUED", "ACKNOWLEDGED"] },
          }
        : {}),
      ...(issueFrom || issueTo
        ? {
            issueDate: {
              ...(issueFrom ? { gte: issueFrom } : {}),
              ...(issueTo ? { lte: issueTo } : {}),
            },
          }
        : {}),
      ...(filters.query
        ? {
            OR: [
              { title: { contains: filters.query, mode: "insensitive" } },
              { subType: { contains: filters.query, mode: "insensitive" } },
              {
                employee: {
                  OR: [
                    {
                      firstName: {
                        contains: filters.query,
                        mode: "insensitive",
                      },
                    },
                    {
                      lastName: {
                        contains: filters.query,
                        mode: "insensitive",
                      },
                    },
                    {
                      employeeNumber: {
                        contains: filters.query,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ issueDate: "desc" }, { effectiveDate: "desc" }],
    take: 200,
    select: {
      id: true,
      category: true,
      subType: true,
      title: true,
      status: true,
      issueDate: true,
      effectiveDate: true,
      requiresAcknowledgement: true,
      retentionUntil: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
    },
  });

  const items: OrgCorrespondenceSearchItem[] = records.map((record) => ({
    id: record.id,
    employeeId: record.employee.id,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
    employeeNumber: record.employee.employeeNumber,
    category: record.category,
    subType: record.subType,
    title: record.title,
    status: record.status,
    issueDate: record.issueDate?.toISOString().slice(0, 10) ?? null,
    effectiveDate: record.effectiveDate.toISOString().slice(0, 10),
    requiresAcknowledgement: record.requiresAcknowledgement,
    isAckOverdue: isAcknowledgementOverdue({
      status: record.status,
      requiresAcknowledgement: record.requiresAcknowledgement,
      issueDate: record.issueDate,
    }),
    retentionUntil: record.retentionUntil?.toISOString().slice(0, 10) ?? null,
    detailHref: `/people/employees/${record.employee.id}/documents/${record.id}`,
  }));

  return {
    items,
    total: items.length,
  };
}

/** Count issued/acknowledged letters whose retention date has already passed. */
export async function countPastRetentionCorrespondence(
  organizationId: string,
  asOf: Date = new Date(),
): Promise<number> {
  const today = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );

  return prisma.employeeCorrespondence.count({
    where: {
      organizationId,
      status: { in: ["ISSUED", "ACKNOWLEDGED"] },
      retentionUntil: {
        not: null,
        lt: today,
      },
    },
  });
}
