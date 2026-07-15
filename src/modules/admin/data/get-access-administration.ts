import { prisma } from "@/lib/prisma"

export type AccessUserListItem = {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  isActive: boolean
  lastLoginAt: Date | null
  roleCount: number
}

export type AccessRoleListItem = {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  updatedAt: Date
  permissionCount: number
  userCount: number
}

export type PermissionOption = {
  id: string
  code: string
  name: string
  description: string | null
  moduleKey: string
}

export type RoleRecord = {
  id: string
  organizationId: string | null
  code: string
  name: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  updatedAt: Date
  permissionIds: string[]
}

async function getOrganizationId(): Promise<string | null> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  })

  return organization?.id ?? null
}

export async function getAccessAdministration(): Promise<{
  users: AccessUserListItem[]
  roles: AccessRoleListItem[]
  permissionCount: number
}> {
  const organizationId = await getOrganizationId()

  if (!organizationId) {
    return {
      users: [],
      roles: [],
      permissionCount: 0,
    }
  }

  const [users, roles, permissionCount] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId,
      },
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
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        isActive: true,
        lastLoginAt: true,
        _count: {
          select: {
            roles: true,
          },
        },
      },
    }),

    prisma.role.findMany({
      where: {
        OR: [
          {
            organizationId,
          },
          {
            organizationId: null,
          },
        ],
      },
      orderBy: [
        {
          isSystem: "desc",
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
        isSystem: true,
        isActive: true,
        updatedAt: true,
        _count: {
          select: {
            permissions: true,
            users: true,
          },
        },
      },
    }),

    prisma.permission.count({
      where: {
        isActive: true,
      },
    }),
  ])

  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      roleCount: user._count.roles,
    })),

    roles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      updatedAt: role.updatedAt,
      permissionCount: role._count.permissions,
      userCount: role._count.users,
    })),

    permissionCount,
  }
}

export async function getRole(id: string): Promise<RoleRecord | null> {
  const role = await prisma.role.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      organizationId: true,
      code: true,
      name: true,
      description: true,
      isSystem: true,
      isActive: true,
      updatedAt: true,
      permissions: {
        select: {
          permissionId: true,
        },
      },
    },
  })

  if (!role) {
    return null
  }

  return {
    id: role.id,
    organizationId: role.organizationId,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    updatedAt: role.updatedAt,
    permissionIds: role.permissions.map(
      (permission) => permission.permissionId,
    ),
  }
}

export async function getPermissionOptions(): Promise<
  PermissionOption[]
> {
  return prisma.permission.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      {
        moduleKey: "asc",
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
      moduleKey: true,
    },
  })
}
