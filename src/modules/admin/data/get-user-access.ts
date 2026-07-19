import { prisma } from "@/lib/prisma";

export type UserRoleAssignment = {
  id: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  status: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  assignedAt: Date;
  revokedAt: Date | null;
  reason: string | null;
};

export type UserAccessRecord = {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  isActive: boolean;
  employeeId: string | null;
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    positionTitle: string | null;
  } | null;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  mustChangePassword: boolean;
  version: number;
  updatedAt: Date;
  assignments: UserRoleAssignment[];
};

export type LinkableEmployeeOption = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  positionTitle: string | null;
  alreadyLinked: boolean;
};

export type AssignableRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

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
      employeeId: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      mustChangePassword: true,
      version: true,
      updatedAt: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          position: {
            select: {
              title: true,
            },
          },
        },
      },
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
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    isActive: user.isActive,
    employeeId: user.employeeId,
    employee: user.employee
      ? {
          id: user.employee.id,
          employeeNumber: user.employee.employeeNumber,
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          positionTitle: user.employee.position?.title ?? null,
        }
      : null,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    mustChangePassword: user.mustChangePassword,
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
  };
}

export async function getLinkableEmployees(
  organizationId: string,
  currentEmployeeId?: string | null,
): Promise<LinkableEmployeeOption[]> {
  const employees = await prisma.employee.findMany({
    where: {
      organizationId,
      isArchived: false,
      OR: [
        {
          user: null,
        },
        ...(currentEmployeeId
          ? [
              {
                id: currentEmployeeId,
              },
            ]
          : []),
      ],
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
      employeeNumber: true,
      firstName: true,
      lastName: true,
      position: {
        select: {
          title: true,
        },
      },
      user: {
        select: {
          id: true,
        },
      },
    },
  });

  return employees.map((employee) => ({
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    positionTitle: employee.position?.title ?? null,
    alreadyLinked: Boolean(employee.user),
  }));
}

/**
 * Active roles available for assignment (built-in system roles and custom
 * org roles). Includes organization-scoped roles and global (null org) roles.
 */
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
  });
}
