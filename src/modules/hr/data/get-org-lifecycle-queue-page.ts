import { prisma } from "@/lib/prisma";
import { getSessionOrganizationId } from "@/src/modules/auth/lib/organization-scope";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";
import { getOrgLifecycleQueue } from "@/src/modules/hr/services/employee-lifecycle-cases";

export async function getOrgLifecycleQueuePageData() {
  await requirePeopleManageAccess();

  const __sessionOrganizationId = await getSessionOrganizationId();
    const organization = __sessionOrganizationId
      ? { id: __sessionOrganizationId }
      : null;

  if (!organization) {
    throw new Error("No organization is configured.");
  }

  const items = await getOrgLifecycleQueue(organization.id, 75);
  return {
    organizationId: organization.id,
    items,
  };
}
