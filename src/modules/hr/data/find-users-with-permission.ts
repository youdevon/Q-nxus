import { prisma } from "@/lib/prisma";

/**
 * Active users in an organization who hold a permission via an active role,
 * or who are SYSTEM_ADMINISTRATOR (implicit full access).
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
          status: "ACTIVE",
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
