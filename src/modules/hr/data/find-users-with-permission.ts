import { prisma } from "@/lib/prisma";
import { effectiveUserRoleWhere } from "@/src/modules/auth/lib/effective-user-role";

export type PermissionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

/**
 * Active users in an organization who hold a permission via an currently
 * effective role, or who are SYSTEM_ADMINISTRATOR (implicit full access).
 */
export async function findUsersWithPermission(
  organizationId: string,
  permissionCode: string,
): Promise<PermissionUser[]> {
  return findUsersWithAnyPermission(organizationId, [permissionCode]);
}

/**
 * Active users who hold any of the given permissions (or SYSTEM_ADMINISTRATOR).
 */
export async function findUsersWithAnyPermission(
  organizationId: string,
  permissionCodes: string[],
): Promise<PermissionUser[]> {
  const codes = [...new Set(permissionCodes.map((code) => code.trim()).filter(Boolean))];
  if (codes.length === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      roles: {
        some: {
          ...effectiveUserRoleWhere(),
          role: {
            isActive: true,
            OR: [
              { code: "SYSTEM_ADMINISTRATOR" },
              {
                permissions: {
                  some: {
                    permission: {
                      code: { in: codes },
                      isActive: true,
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
