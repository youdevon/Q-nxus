import { prisma } from "@/lib/prisma";

export type BusinessUnitListItem = {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  status: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  updatedAt: Date;
  parent: {
    id: string;
    name: string;
    code: string;
  } | null;
  childCount: number;
};

export type BusinessUnitRecord = {
  id: string;
  organizationId: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  status: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  updatedAt: Date;
};

export type BusinessUnitOption = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
};

async function getOrganizationId(): Promise<string | null> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  return organization?.id ?? null;
}

export async function getBusinessUnits(): Promise<BusinessUnitListItem[]> {
  const organizationId = await getOrganizationId();

  if (!organizationId) {
    return [];
  }

  const records = await prisma.businessUnit.findMany({
    where: {
      organizationId,
    },
    orderBy: [
      {
        name: "asc",
      },
    ],
    select: {
      id: true,
      parentId: true,
      code: true,
      name: true,
      description: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
      updatedAt: true,
      parent: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      _count: {
        select: {
          children: true,
        },
      },
    },
  });

  return records.map((record) => ({
    id: record.id,
    parentId: record.parentId,
    code: record.code,
    name: record.name,
    description: record.description,
    status: record.status,
    effectiveFrom: record.effectiveFrom,
    effectiveUntil: record.effectiveUntil,
    updatedAt: record.updatedAt,
    parent: record.parent,
    childCount: record._count.children,
  }));
}

export async function getBusinessUnit(
  id: string,
): Promise<BusinessUnitRecord | null> {
  return prisma.businessUnit.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      organizationId: true,
      parentId: true,
      code: true,
      name: true,
      description: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
      updatedAt: true,
    },
  });
}

export async function getBusinessUnitOptions(
  excludedId?: string,
): Promise<BusinessUnitOption[]> {
  const organizationId = await getOrganizationId();

  if (!organizationId) {
    return [];
  }

  return prisma.businessUnit.findMany({
    where: {
      organizationId,
      status: {
        not: "ARCHIVED",
      },
      ...(excludedId
        ? {
            id: {
              not: excludedId,
            },
          }
        : {}),
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      parentId: true,
    },
  });
}
