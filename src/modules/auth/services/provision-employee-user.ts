import {
  RoleAssignmentStatus,
  UserAccountStatus,
  UserRoleSource,
  type Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildEmployeeUserEmail } from "@/src/modules/auth/lib/employee-login-email";
import { hashPassword } from "@/src/modules/auth/lib/password";
import { planPositionRoleSync } from "@/src/modules/auth/lib/position-role-sync";
import { canSyncPositionRoleCode } from "@/src/modules/auth/lib/position-system-roles";

export {
  buildEmployeeUserEmail,
  normalizeLoginEmail,
} from "@/src/modules/auth/lib/employee-login-email";

const DEFAULT_EMPLOYEE_PASSWORD =
  process.env.DEFAULT_EMPLOYEE_PASSWORD ?? "ChangeMe123!";

type DbClient = Prisma.TransactionClient | typeof prisma;

export class EmployeeLoginEmailConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeLoginEmailConflictError";
  }
}

async function ensureEmployeeSelfServiceRole(
  db: DbClient,
  userId: string,
  organizationId: string,
) {
  const employeeRole = await db.role.findFirst({
    where: {
      organizationId,
      code: "EMPLOYEE",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!employeeRole) {
    throw new Error(
      "The EMPLOYEE self-service role is not configured for this organization.",
    );
  }

  const existing = await db.userRole.findFirst({
    where: {
      userId,
      roleId: employeeRole.id,
      status: RoleAssignmentStatus.ACTIVE,
      source: UserRoleSource.SELF_SERVICE,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    // Also accept a legacy ACTIVE EMPLOYEE grant without source metadata.
    const legacy = await db.userRole.findFirst({
      where: {
        userId,
        roleId: employeeRole.id,
        status: RoleAssignmentStatus.ACTIVE,
      },
      select: {
        id: true,
        source: true,
      },
    });

    if (legacy) {
      if (legacy.source !== UserRoleSource.SELF_SERVICE) {
        await db.userRole.update({
          where: { id: legacy.id },
          data: { source: UserRoleSource.SELF_SERVICE },
        });
      }
      return;
    }

    await db.userRole.create({
      data: {
        userId,
        roleId: employeeRole.id,
        status: RoleAssignmentStatus.ACTIVE,
        effectiveFrom: new Date(),
        reason: "Default employee self-service access.",
        source: UserRoleSource.SELF_SERVICE,
      },
    });
  }
}

export async function syncEmployeeUserLoginEmail(
  userId: string,
  employeeId: string,
  db: DbClient = prisma,
): Promise<{ email: string; updated: boolean }> {
  const employee = await db.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      personalEmail: true,
    },
  });

  if (!employee) {
    throw new Error("The employee record could not be found.");
  }

  const email = buildEmployeeUserEmail(employee);
  const conflictingUser = await db.user.findFirst({
    where: {
      email,
      id: {
        not: userId,
      },
    },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  if (conflictingUser) {
    const name = `${conflictingUser.firstName} ${conflictingUser.lastName}`.trim();

    throw new EmployeeLoginEmailConflictError(
      `Cannot use ${email} as the employee login email because it is already assigned to ${name || "another user"}.`,
    );
  }

  const currentUser = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      email: true,
    },
  });

  if (!currentUser) {
    throw new Error("The user account could not be found.");
  }

  if (currentUser.email === email) {
    return {
      email,
      updated: false,
    };
  }

  await db.user.update({
    where: {
      id: userId,
    },
    data: {
      email,
      version: {
        increment: 1,
      },
    },
  });

  return {
    email,
    updated: true,
  };
}

export async function provisionEmployeeUser(
  employeeId: string,
  db: DbClient = prisma,
) {
  const employee = await db.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      personalEmail: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!employee) {
    throw new Error("The employee record could not be found.");
  }

  if (employee.user) {
    const synced = await syncEmployeeUserLoginEmail(
      employee.user.id,
      employee.id,
      db,
    );
    await ensureEmployeeSelfServiceRole(
      db,
      employee.user.id,
      employee.organizationId,
    );
    return {
      userId: employee.user.id,
      created: false,
      email: synced.email,
    };
  }

  const email = buildEmployeeUserEmail(employee);

  const existingEmail = await db.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      employeeId: true,
    },
  });

  if (existingEmail?.employeeId && existingEmail.employeeId !== employeeId) {
    throw new Error(
      `Cannot create a user account because ${email} is already linked to another employee.`,
    );
  }

  const passwordHash = hashPassword(DEFAULT_EMPLOYEE_PASSWORD);

  const user =
    existingEmail && !existingEmail.employeeId
      ? await db.user.update({
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
      : await db.user.create({
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
        });

  // Create grants only self-service EMPLOYEE. Elevated roles (HR, payroll, leave
  // approver, position systemRoleCode) are assigned later via Access admin or
  // syncEmployeeAccessRoles when assignments / structure change.
  await ensureEmployeeSelfServiceRole(db, user.id, employee.organizationId);

  return {
    userId: user.id,
    created: !existingEmail,
    email: user.email,
  };
}

/**
 * Sync position-linked elevated roles (leave approver, systemRoleCode).
 * Always ensures the base EMPLOYEE self-service role remains assigned.
 *
 * Never grants SYSTEM_ADMINISTRATOR or other non-allowlisted codes.
 * Creates/revokes by UserRole.source = POSITION, not reason text.
 */
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
  });

  if (!employee) {
    return;
  }

  await ensureEmployeeSelfServiceRole(
    prisma,
    userId,
    employee.organizationId,
  );

  const positionId = employee.position?.id ?? null;
  const rawSystemRoleCode = employee.position?.systemRoleCode?.trim() || null;
  const hasDirectReports =
    (employee.position?._count.directReports ?? 0) > 0;

  const plan = planPositionRoleSync({
    systemRoleCode: rawSystemRoleCode,
    hasDirectReports,
  });

  const rolesByCode = new Map<string, { id: string; code: string }>();

  if (plan.desiredCodes.length > 0) {
    const roles = await prisma.role.findMany({
      where: {
        organizationId: employee.organizationId,
        code: { in: plan.desiredCodes },
        isActive: true,
      },
      select: {
        id: true,
        code: true,
      },
    });

    for (const role of roles) {
      rolesByCode.set(role.code, role);
    }
  }

  const desiredRoleIds = new Set<string>();

  for (const code of plan.desiredCodes) {
    const role = rolesByCode.get(code);
    if (!role) {
      continue;
    }

    desiredRoleIds.add(role.id);

    const existingPositionGrant = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
        status: RoleAssignmentStatus.ACTIVE,
        source: UserRoleSource.POSITION,
      },
      select: {
        id: true,
        sourcePositionId: true,
      },
    });

    if (existingPositionGrant) {
      // Keep the grant and refresh provenance when the employee moves seats.
      if (existingPositionGrant.sourcePositionId !== positionId) {
        await prisma.userRole.update({
          where: { id: existingPositionGrant.id },
          data: { sourcePositionId: positionId },
        });
      }
      continue;
    }

    const anyActive = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
        status: RoleAssignmentStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (anyActive) {
      // Respect MANUAL (or other) grants — do not duplicate as POSITION.
      continue;
    }

    if (!canSyncPositionRoleCode(code) && code !== "LEAVE_APPROVER") {
      continue;
    }

    await prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
        status: RoleAssignmentStatus.ACTIVE,
        effectiveFrom: new Date(),
        reason: `Access granted from position role ${role.code}.`,
        source: UserRoleSource.POSITION,
        sourcePositionId: positionId,
      },
    });
  }

  const keepRoleIds = [...desiredRoleIds];

  const toRevoke = await prisma.userRole.findMany({
    where: {
      userId,
      status: RoleAssignmentStatus.ACTIVE,
      source: UserRoleSource.POSITION,
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
  });

  if (toRevoke.length > 0) {
    await prisma.userRole.updateMany({
      where: {
        id: {
          in: toRevoke.map((item) => item.id),
        },
      },
      data: {
        status: RoleAssignmentStatus.REVOKED,
        revokedAt: new Date(),
        effectiveUntil: new Date(),
      },
    });
  }
}
