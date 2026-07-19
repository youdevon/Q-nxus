import { prisma } from "@/lib/prisma";
import { requireContractManageAccess } from "@/src/modules/hr/data/require-people-access";
import { getContractWorkflowSettings } from "@/src/modules/hr/data/get-contract-workflow-settings";

export async function getContractWorkflowSettingsPageData() {
  await requireContractManageAccess();

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new Error("No organization is configured.");
  }

  const [settings, positions] = await Promise.all([
    getContractWorkflowSettings(organization.id),
    prisma.position.findMany({
      where: {
        isActive: true,
        department: {
          organizationId: organization.id,
          isActive: true,
        },
      },
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        title: true,
        code: true,
        department: {
          select: {
            name: true,
          },
        },
        assignments: {
          where: { isCurrent: true },
          take: 1,
          select: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    organizationName: organization.name,
    settings,
    positions: positions.map((position) => {
      const holder = position.assignments[0]?.employee;
      return {
        id: position.id,
        title: position.title,
        code: position.code,
        departmentName: position.department.name,
        holderName: holder
          ? `${holder.firstName} ${holder.lastName}`
          : null,
      };
    }),
  };
}

export type ContractWorkflowSettingsPageData = Awaited<
  ReturnType<typeof getContractWorkflowSettingsPageData>
>;
