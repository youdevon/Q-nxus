import type { PrismaClient } from "../generated/prisma/client";

/** Stable code for the org-wide catch-all department. */
export const GENERAL_DEPARTMENT_CODE = "GENERAL";

const GENERAL_DEPARTMENT_NAME = "General";

/** Org-wide/support roles (custodian, cleaner, etc.) without a specific unit. */
const GENERAL_DEPARTMENT_DESCRIPTION =
  "Org-wide and support roles without a specific operational unit (e.g. custodian, cleaner).";

/**
 * Ensures a General department exists for the organization.
 * Reuses an existing "General" / "General Services" department when present.
 */
export async function seedGeneralDepartment(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const existingByCode = await prisma.department.findFirst({
    where: {
      organizationId,
      code: {
        equals: GENERAL_DEPARTMENT_CODE,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (existingByCode) {
    await prisma.department.update({
      where: {
        id: existingByCode.id,
      },
      data: {
        name: GENERAL_DEPARTMENT_NAME,
        description: GENERAL_DEPARTMENT_DESCRIPTION,
        isActive: true,
      },
    });
    return;
  }

  const existingByName = await prisma.department.findFirst({
    where: {
      organizationId,
      OR: [
        {
          name: {
            equals: GENERAL_DEPARTMENT_NAME,
            mode: "insensitive",
          },
        },
        {
          name: {
            equals: "General Services",
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (existingByName) {
    await prisma.department.update({
      where: {
        id: existingByName.id,
      },
      data: {
        ...(existingByName.code ? {} : { code: GENERAL_DEPARTMENT_CODE }),
        description: GENERAL_DEPARTMENT_DESCRIPTION,
        isActive: true,
      },
    });
    return;
  }

  await prisma.department.create({
    data: {
      organizationId,
      code: GENERAL_DEPARTMENT_CODE,
      name: GENERAL_DEPARTMENT_NAME,
      description: GENERAL_DEPARTMENT_DESCRIPTION,
      isActive: true,
    },
  });
}
