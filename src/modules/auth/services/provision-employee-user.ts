import {
  RoleAssignmentStatus,
  UserAccountStatus,
} from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/src/modules/auth/lib/password"

const DEFAULT_EMPLOYEE_PASSWORD =
  process.env.DEFAULT_EMPLOYEE_PASSWORD ?? "ChangeMe123!"

export function buildEmployeeUserEmail(employee: {
  workEmail: string | null
  employeeNumber: string
  firstName: string
  lastName: string
}): string {
  if (employee.workEmail?.trim()) {
    return employee.workEmail.trim().toLowerCase()
  }

  const slug = `${employee.firstName}.${employee.lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "")

  return `${slug || employee.employeeNumber.toLowerCase()}@q-nxus.local`
}

export async function provisionEmployeeUser(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      workEmail: true,
      user: {
        select: {
          id: true,
        },
      },
      position: {
        select: {
          systemRoleCode: true,
        },
      },
    },
  })

  if (!employee) {
    throw new Error("The employee record could not be found.")
  }

  if (employee.user) {
    await syncEmployeeAccessRoles(employee.user.id, employeeId)
    return {
      userId: employee.user.id,
      created: false,
      email: null as string | null,
    }
  }

  const email = buildEmployeeUserEmail(employee)

  const existingEmail = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      employeeId: true,
    },
  })

  if (existingEmail?.employeeId && existingEmail.employeeId !== employeeId) {
    throw new Error(
      `Cannot create a user account because ${email} is already linked to another employee.`,
    )
  }

  const passwordHash = hashPassword(DEFAULT_EMPLOYEE_PASSWORD)

  const user =
    existingEmail && !existingEmail.employeeId
      ? await prisma.user.update({
          where: {
            id: existingEmail.id,
          },
          data: {
            employeeId: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            passwordHash,
            mustChangePassword: true,
            status: UserAccountStatus.ACTIVE,
            isActive: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
          select: {
            id: true,
            email: true,
          },
        })
      : await prisma.user.create({
          data: {
            organizationId: employee.organizationId,
            email,
            firstName: employee.firstName,
            lastName: employee.lastName,
            passwordHash,
            mustChangePassword: true,
            status: UserAccountStatus.ACTIVE,
            isActive: true,
            emailVerifiedAt: new Date(),
            employeeId: employee.id,
          },
          select: {
            id: true,
            email: true,
          },
        })

  await syncEmployeeAccessRoles(user.id, employeeId)

  return {
    userId: user.id,
    created: !existingEmail,
    email: user.email,
  }
}

export async function syncEmployeeAccessRoles(
  userId: string,
  employeeId: string,
) {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      organizationId: true,
      positionId: true,
      position: {
        select: {
          id: true,
          systemRoleCode: true,
          _count: {
            select: {
              directReports: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!employee) {
    return
  }

  const employeeRole = await prisma.role.findFirst({
    where: {
      organizationId: employee.organizationId,
      code: "EMPLOYEE",
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  if (employeeRole) {
    const existing = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: employeeRole.id,
        status: RoleAssignmentStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    })

    if (!existing) {
      await prisma.userRole.create({
        data: {
          userId,
          roleId: employeeRole.id,
          status: RoleAssignmentStatus.ACTIVE,
          effectiveFrom: new Date(),
          reason: "Default employee self-service access.",
        },
      })
    }
  }

  const isLeaveApprover =
    (employee.position?._count.directReports ?? 0) > 0 ||
    employee.position?.systemRoleCode?.trim() ===
      "LEAVE_APPROVER"

  const leaveApproverRole = await prisma.role.findFirst({
    where: {
      organizationId: employee.organizationId,
      code: "LEAVE_APPROVER",
      isActive: true,
    },
    select: {
      id: true,
      code: true,
    },
  })

  if (leaveApproverRole && isLeaveApprover) {
    const existingApprover = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: leaveApproverRole.id,
        status: RoleAssignmentStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    })

    if (!existingApprover) {
      await prisma.userRole.create({
        data: {
          userId,
          roleId: leaveApproverRole.id,
          status: RoleAssignmentStatus.ACTIVE,
          effectiveFrom: new Date(),
          reason:
            "Access granted from position role LEAVE_APPROVER.",
        },
      })
    }
  }

  const elevatedCode = employee.position?.systemRoleCode?.trim()
  const elevatedRole =
    elevatedCode &&
    elevatedCode !== "EMPLOYEE" &&
    elevatedCode !== "LEAVE_APPROVER"
      ? await prisma.role.findFirst({
          where: {
            organizationId: employee.organizationId,
            code: elevatedCode,
            isActive: true,
          },
          select: {
            id: true,
            code: true,
          },
        })
      : null

  if (elevatedRole) {
    const existingElevated = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: elevatedRole.id,
        status: RoleAssignmentStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    })

    if (!existingElevated) {
      await prisma.userRole.create({
        data: {
          userId,
          roleId: elevatedRole.id,
          status: RoleAssignmentStatus.ACTIVE,
          effectiveFrom: new Date(),
          reason: `Access granted from position role ${elevatedRole.code}.`,
        },
      })
    }
  }

  const keepRoleIds = [
    elevatedRole?.id,
    isLeaveApprover ? leaveApproverRole?.id : null,
  ].filter((id): id is string => Boolean(id))

  const positionLinkedRoles = await prisma.userRole.findMany({
    where: {
      userId,
      status: RoleAssignmentStatus.ACTIVE,
      reason: {
        startsWith: "Access granted from position role ",
      },
      ...(keepRoleIds.length > 0
        ? {
            roleId: {
              notIn: keepRoleIds,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  })

  if (positionLinkedRoles.length > 0) {
    await prisma.userRole.updateMany({
      where: {
        id: {
          in: positionLinkedRoles.map((item) => item.id),
        },
      },
      data: {
        status: RoleAssignmentStatus.REVOKED,
        revokedAt: new Date(),
        effectiveUntil: new Date(),
      },
    })
  }
}
