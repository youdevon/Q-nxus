import { prisma } from "@/lib/prisma"

export type UserRoleAssignment = {
  id: string
  roleId: string
  roleCode: string
  roleName: string
  status: string
  effectiveFrom: Date
  effectiveUntil: Date | null
  assignedAt: Date
  revokedAt: Date | null
  reason: string | null
}

export type UserAccessRecord = {
  id: string
  organizationId: string
  email: string
  firstName: string
  lastName: string
  status: string
  isActive: boolean
  emailVerifiedAt: Date | null
  lastLoginAt: Date | null
  failedLoginAttempts: number
  lockedUntil: Date | null
  version: number
  updatedAt: Date
  assignments: UserRoleAssignment[]
}

export type AssignableRole = {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
}

export async function getUserAccess(
  id: string,
): Promise<UserAccessRecord | null> {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      organizationId: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      isActive: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      version: true,
      updatedAt: true,
      roles: {
        orderBy: {
          assignedAt: "desc",
        },
        select: {
          id: true,
          roleId: true,
          status: true,
          effectiveFrom: true,
          effectiveUntil: true,
          assignedAt: true,
          revokedAt: true,
          reason: true,
          role: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    return null
  }

  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    isActive: user.isActive,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    version: user.version,
    updatedAt: user.updatedAt,
    assignments: user.roles.map((assignment) => ({
      id: assignment.id,
      roleId: assignment.roleId,
      roleCode: assignment.role.code,
      roleName: assignment.role.name,
      status: assignment.status,
      effectiveFrom: assignment.effectiveFrom,
      effectiveUntil: assignment.effectiveUntil,
      assignedAt: assignment.assignedAt,
      revokedAt: assignment.revokedAt,
      reason: assignment.reason,
    })),
  }
}

export async function getAssignableRoles(
  organizationId: string,
): Promise<AssignableRole[]> {
  return prisma.role.findMany({
    where: {
      isActive: true,
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
    },
  })
}
