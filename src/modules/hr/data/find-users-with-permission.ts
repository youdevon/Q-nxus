import { prisma } from "@/lib/prisma";
import { effectiveUserRoleWhere } from "@/src/modules/auth/lib/effective-user-role";

/**
 * Active users in an organization who hold a permission via an currently
 * effective role, or who are SYSTEM_ADMINISTRATOR (implicit full access).
 */
export async function findUsersWithPermission(
  organizationId: string,
  permissionCode: string,
) {
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
                      code: permissionCode,
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
