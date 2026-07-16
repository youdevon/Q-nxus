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

export type DepartmentProfileRecord = {
  id: string
  name: string
  code: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  positions: {
    id: string
    title: string
    code: string | null
    description: string | null
    isActive: boolean
    employeeCount: number
  }[]
  employees: {
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    employmentStatus: string
    positionTitle: string | null
  }[]
}

export async function getDepartmentProfile(
  id: string,
): Promise<DepartmentProfileRecord | null> {
  const department = await prisma.department.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
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
          _count: {
            select: {
              employees: true,
            },
          },
        },
      },
      employees: {
        orderBy: [
          {
            lastName: "asc",
          },
          {
            firstName: "asc",
          },
        ],
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          employmentStatus: true,
          position: {
            select: {
              title: true,
            },
          },
        },
      },
    },
  })

  if (!department) {
    return null
  }

  return {
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description,
    isActive: department.isActive,
    createdAt: department.createdAt.toISOString(),
    updatedAt: department.updatedAt.toISOString(),
    positions: department.positions.map((position) => ({
      id: position.id,
      title: position.title,
      code: position.code,
      description: position.description,
      isActive: position.isActive,
      employeeCount: position._count.employees,
    })),
    employees: department.employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employmentStatus: employee.employmentStatus,
      positionTitle: employee.position?.title ?? null,
    })),
  }
}

export type PositionProfileRecord = {
  id: string
  title: string
  code: string | null
  description: string | null
  systemRoleCode: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  department: {
    id: string
    name: string
    code: string | null
  }
  employees: {
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    employmentStatus: string
  }[]
  jobDescriptions: {
    id: string
    versionNumber: number
    title: string
    status: string
    isCurrent: boolean
    effectiveFrom: string
  }[]
}

export async function getPositionProfile(
  id: string,
): Promise<PositionProfileRecord | null> {
  const position = await prisma.position.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      title: true,
      code: true,
      description: true,
      systemRoleCode: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      employees: {
        orderBy: [
          {
            lastName: "asc",
          },
          {
            firstName: "asc",
          },
        ],
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          employmentStatus: true,
        },
      },
      jobDescriptions: {
        orderBy: {
          versionNumber: "desc",
        },
        select: {
          id: true,
          versionNumber: true,
          title: true,
          status: true,
          isCurrent: true,
          effectiveFrom: true,
        },
      },
    },
  })

  if (!position) {
    return null
  }

  return {
    id: position.id,
    title: position.title,
    code: position.code,
    description: position.description,
    systemRoleCode: position.systemRoleCode,
    isActive: position.isActive,
    createdAt: position.createdAt.toISOString(),
    updatedAt: position.updatedAt.toISOString(),
    department: position.department,
    employees: position.employees,
    jobDescriptions: position.jobDescriptions.map(
      (jobDescription) => ({
        id: jobDescription.id,
        versionNumber: jobDescription.versionNumber,
        title: jobDescription.title,
        status: jobDescription.status,
        isCurrent: jobDescription.isCurrent,
        effectiveFrom: jobDescription.effectiveFrom
          .toISOString()
          .slice(0, 10),
      }),
    ),
  }
}
