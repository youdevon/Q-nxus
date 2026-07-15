import { prisma } from "@/lib/prisma"

export type DepartmentRecord = {
  id: string
  name: string
  code: string | null
  description: string | null
  isActive: boolean
  updatedAt: string
  employeeCount: number
  positions: {
    id: string
    title: string
    code: string | null
    description: string | null
    isActive: boolean
    updatedAt: string
    employeeCount: number
  }[]
}

export async function getPeopleStructure(): Promise<
  DepartmentRecord[]
> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  })

  if (!organization) {
    return []
  }

  const departments = await prisma.department.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      isActive: true,
      updatedAt: true,
      _count: {
        select: {
          employees: true,
        },
      },
      positions: {
        orderBy: {
          title: "asc",
        },
        select: {
          id: true,
          title: true,
          code: true,
          description: true,
          isActive: true,
          updatedAt: true,
          _count: {
            select: {
              employees: true,
            },
          },
        },
      },
    },
  })

  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description,
    isActive: department.isActive,
    updatedAt: department.updatedAt.toISOString(),
    employeeCount: department._count.employees,
    positions: department.positions.map((position) => ({
      id: position.id,
      title: position.title,
      code: position.code,
      description: position.description,
      isActive: position.isActive,
      updatedAt: position.updatedAt.toISOString(),
      employeeCount: position._count.employees,
    })),
  }))
}
