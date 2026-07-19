import { prisma } from "@/lib/prisma";
import { syncEmployeeAccessRoles } from "@/src/modules/auth/services/provision-employee-user";

/**
 * After a successful hire (employee create + user provision), sync position-linked
 * elevated roles. Assign/structure paths call `syncEmployeeAccessRoles` directly;
 * hire goes through this helper so create stays thin and always runs post-commit.
 */
export async function syncHireAccessRoles(employeeId: string): Promise<void> {
  const linkedUser = await prisma.user.findFirst({
    where: {
      employeeId,
    },
    select: {
      id: true,
    },
  });

  if (!linkedUser) {
    return;
  }

  await syncEmployeeAccessRoles(linkedUser.id, employeeId);
}
