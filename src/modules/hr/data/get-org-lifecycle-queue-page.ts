import { prisma } from "@/lib/prisma";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";
import { getOrgLifecycleQueue } from "@/src/modules/hr/services/employee-lifecycle-cases";

export async function getOrgLifecycleQueuePageData() {
  await requirePeopleManageAccess();

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!organization) {
    throw new Error("No organization is configured.");
  }

  const items = await getOrgLifecycleQueue(organization.id, 75);
  return {
    organizationId: organization.id,
    items,
  };
}
