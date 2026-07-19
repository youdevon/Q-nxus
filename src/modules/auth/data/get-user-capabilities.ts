import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import { effectiveUserRoleWhere } from "@/src/modules/auth/lib/effective-user-role";
import {
  aggregatePermissionsFromRoles,
  collectRoleCodes,
  isEmployeeOnlyAccess,
  isHrAdministrator,
  isSystemAdministrator,
} from "@/src/modules/auth/lib/role-capabilities";

export type UserCapabilities = {
  userId: string;
  employeeId: string | null;
  permissions: string[];
  roleCodes: string[];
  isSystemAdmin: boolean;
  isHrAdmin: boolean;
  isEmployeeOnly: boolean;
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
};

async function loadUserCapabilities(
  userId?: string,
): Promise<UserCapabilities | null> {
  // Prefer the cached session user so layout + page share one DB round-trip.
  const sessionUser = await getCurrentUser();
  const current =
    userId && sessionUser?.id !== userId
      ? await prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            employeeId: true,
            isActive: true,
          },
        })
      : sessionUser;

  if (!current?.isActive) {
    return null;
  }

  const assignments = await prisma.userRole.findMany({
    where: {
      userId: current.id,
      ...effectiveUserRoleWhere(),
      role: {
        isActive: true,
      },
    },
    select: {
      role: {
        select: {
          code: true,
          permissions: {
            select: {
              permission: {
                select: {
                  code: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const grants = assignments.map((item) => ({
    roleCode: item.role.code,
    permissionCodes: item.role.permissions
      .filter((entry) => entry.permission.isActive)
      .map((entry) => entry.permission.code),
  }));

  const roleCodes = collectRoleCodes(grants);
  const permissions = aggregatePermissionsFromRoles(grants);

  const isSystemAdmin = isSystemAdministrator(roleCodes);
  const isHrAdmin = isHrAdministrator(roleCodes);

  return {
    userId: current.id,
    employeeId: current.employeeId,
    permissions,
    roleCodes,
    isSystemAdmin,
    isHrAdmin,
    isEmployeeOnly: isEmployeeOnlyAccess(roleCodes, permissions),
    can(permission: string) {
      return isSystemAdmin || permissions.includes(permission);
    },
    canAny(...required: string[]) {
      return (
        isSystemAdmin ||
        required.some((permission) => permissions.includes(permission))
      );
    },
  };
}

/**
 * Deduped per React request. Prefer calling without args so layout + pages
 * share the same cache entry as the root layout session path.
 */
export const getUserCapabilities = cache(
  async (userId?: string): Promise<UserCapabilities | null> =>
    loadUserCapabilities(userId),
);

export async function requireCapability(
  ...permissions: string[]
): Promise<UserCapabilities> {
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    throw new Error("An active user account is required.");
  }

  if (permissions.length > 0 && !capabilities.canAny(...permissions)) {
    throw new Error("You do not have permission to perform this action.");
  }

  return capabilities;
}

export async function requireActor(...permissions: string[]): Promise<
  | {
      ok: true;
      actor: UserCapabilities;
    }
  | {
      ok: false;
      message: string;
    }
> {
  try {
    const actor = await requireCapability(...permissions);
    return {
      ok: true,
      actor,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "You do not have permission to perform this action.",
    };
  }
}
