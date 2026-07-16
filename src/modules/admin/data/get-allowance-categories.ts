import { prisma } from "@/lib/prisma";

export type AllowanceCategoryAdminRecord = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  isTaxableDefault: boolean;
  includedInGratuityDefault: boolean;
  isActive: boolean;
  contractAllowanceCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function getAllowanceCategoryList(): Promise<
  AllowanceCategoryAdminRecord[]
> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return [];
  }

  const categories = await prisma.allowanceCategory.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        name: "asc",
      },
    ],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isTaxableDefault: true,
      includedInGratuityDefault: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          contractAllowances: true,
        },
      },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    code: category.code,
    name: category.name,
    description: category.description,
    isTaxableDefault: category.isTaxableDefault,
    includedInGratuityDefault: category.includedInGratuityDefault,
    isActive: category.isActive,
    contractAllowanceCount: category._count.contractAllowances,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }));
}

export async function getAllowanceCategoryById(
  id: string,
): Promise<AllowanceCategoryAdminRecord | null> {
  const category = await prisma.allowanceCategory.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isTaxableDefault: true,
      includedInGratuityDefault: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          contractAllowances: true,
        },
      },
    },
  });

  if (!category) {
    return null;
  }

  return {
    id: category.id,
    code: category.code,
    name: category.name,
    description: category.description,
    isTaxableDefault: category.isTaxableDefault,
    includedInGratuityDefault: category.includedInGratuityDefault,
    isActive: category.isActive,
    contractAllowanceCount: category._count.contractAllowances,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
