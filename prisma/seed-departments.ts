import type { PrismaClient } from "../generated/prisma/client";

/** Stable code for the org-wide catch-all department. */
export const GENERAL_DEPARTMENT_CODE = "GENERAL";

const GENERAL_DEPARTMENT_NAME = "General";

/** Org-wide/support roles (custodian, cleaner, etc.) without a specific unit. */
const GENERAL_DEPARTMENT_DESCRIPTION =
  "Org-wide and support roles without a specific operational unit (e.g. custodian, cleaner).";

/** Stable code for the board / governing-body department. */
export const BOARD_DEPARTMENT_CODE = "BOARD";

const BOARD_DEPARTMENT_NAME = "Board of Directors";

const BOARD_DEPARTMENT_DESCRIPTION =
  "Governing body roles (Chairman, Deputy Chairman, Director, and related board appointments).";

/** Default board roles used on engagement contracts. */
export const BOARD_POSITION_TITLES = [
  "Chairman",
  "Deputy Chairman",
  "Director",
] as const;

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

async function ensureBoardDepartmentId(
  prisma: PrismaClient,
  organizationId: string,
): Promise<string> {
  const existingByCode = await prisma.department.findFirst({
    where: {
      organizationId,
      code: {
        equals: BOARD_DEPARTMENT_CODE,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingByCode) {
    await prisma.department.update({
      where: { id: existingByCode.id },
      data: {
        name: BOARD_DEPARTMENT_NAME,
        description: BOARD_DEPARTMENT_DESCRIPTION,
        isActive: true,
      },
    });
    return existingByCode.id;
  }

  const existingByName = await prisma.department.findFirst({
    where: {
      organizationId,
      name: {
        equals: BOARD_DEPARTMENT_NAME,
        mode: "insensitive",
      },
    },
    select: { id: true, code: true },
  });

  if (existingByName) {
    await prisma.department.update({
      where: { id: existingByName.id },
      data: {
        ...(existingByName.code ? {} : { code: BOARD_DEPARTMENT_CODE }),
        description: BOARD_DEPARTMENT_DESCRIPTION,
        isActive: true,
      },
    });
    return existingByName.id;
  }

  const created = await prisma.department.create({
    data: {
      organizationId,
      code: BOARD_DEPARTMENT_CODE,
      name: BOARD_DEPARTMENT_NAME,
      description: BOARD_DEPARTMENT_DESCRIPTION,
      isActive: true,
    },
    select: { id: true },
  });

  return created.id;
}

/**
 * Ensures Board of Directors department and standard board roles exist.
 * Idempotent — safe to re-run on existing organizations.
 */
export async function seedBoardDepartmentAndPositions(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const departmentId = await ensureBoardDepartmentId(prisma, organizationId);

  for (const title of BOARD_POSITION_TITLES) {
    const existing = await prisma.position.findFirst({
      where: {
        departmentId,
        title: {
          equals: title,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.position.update({
        where: { id: existing.id },
        data: {
          title,
          isActive: true,
        },
      });
      continue;
    }

    await prisma.position.create({
      data: {
        departmentId,
        title,
        isActive: true,
      },
    });
  }
}
