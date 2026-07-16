import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";

export type UserCapabilities = {
  userId: string;
  employeeId: string | null;
  permissions: string[];
  roleCodes: string[];
  isSystemAdmin: boolean;
  isHrAdmin: boolean;
  isEmployeeOnly: boolean;
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
};

export async function getUserCapabilities(
  userId?: string,
): Promise<UserCapabilities | null> {
  const current = userId
    ? await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          employeeId: true,
          isActive: true,
        },
      })
    : await getCurrentUser();

  if (!current?.isActive) {
    return null;
  }

  const assignments = await prisma.userRole.findMany({
    where: {
      userId: current.id,
      status: "ACTIVE",
      role: {
        isActive: true,
      },
    },
    select: {
      role: {
        select: {
          code: true,
          permissions: {
            select: {
              permission: {
                select: {
                  code: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const roleCodes = [...new Set(assignments.map((item) => item.role.code))];

  const permissions = [
    ...new Set(
      assignments.flatMap((item) =>
        item.role.permissions
          .filter((entry) => entry.permission.isActive)
          .map((entry) => entry.permission.code),
      ),
    ),
  ];

  const isSystemAdmin = roleCodes.includes("SYSTEM_ADMINISTRATOR");
  const isHrAdmin = roleCodes.includes("HR_ADMINISTRATOR");

  return {
    userId: current.id,
    employeeId: current.employeeId,
    permissions,
    roleCodes,
    isSystemAdmin,
    isHrAdmin,
    isEmployeeOnly:
      !isSystemAdmin && !isHrAdmin && roleCodes.includes("EMPLOYEE"),
    can(permission: string) {
      return isSystemAdmin || permissions.includes(permission);
    },
    canAny(...required: string[]) {
      return (
        isSystemAdmin ||
        required.some((permission) => permissions.includes(permission))
      );
    },
  };
}

export async function requireCapability(
  ...permissions: string[]
): Promise<UserCapabilities> {
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    throw new Error("An active user account is required.");
  }

  if (permissions.length > 0 && !capabilities.canAny(...permissions)) {
    throw new Error("You do not have permission to perform this action.");
  }

  return capabilities;
}

export async function requireActor(...permissions: string[]): Promise<
  | {
      ok: true;
      actor: UserCapabilities;
    }
  | {
      ok: false;
      message: string;
    }
> {
  try {
    const actor = await requireCapability(...permissions);
    return {
      ok: true,
      actor,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "You do not have permission to perform this action.",
    };
  }
}
