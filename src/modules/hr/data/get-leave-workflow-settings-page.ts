import { prisma } from "@/lib/prisma";
import { requireLeaveManageAccess } from "@/src/modules/hr/data/require-people-access";
import { getLeaveForfeitureSettings } from "@/src/modules/hr/data/get-leave-forfeiture-settings";
import { getLeaveWorkflowSettings } from "@/src/modules/hr/data/get-leave-workflow-settings";

export async function getLeaveWorkflowSettingsPageData() {
  await requireLeaveManageAccess();

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new Error("No organization is configured.");
  }

  const [settings, forfeitureSettings, positions] = await Promise.all([
    getLeaveWorkflowSettings(organization.id),
    getLeaveForfeitureSettings(organization.id),
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
    forfeitureSettings,
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

export type LeaveWorkflowSettingsPageData = Awaited<
  ReturnType<typeof getLeaveWorkflowSettingsPageData>
>;
