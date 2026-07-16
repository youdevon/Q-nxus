import { prisma } from "@/lib/prisma";
import { readSessionUserId } from "@/src/modules/auth/lib/session-cookie";

const currentUserSelect = {
  id: true,
  organizationId: true,
  employeeId: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  mustChangePassword: true,
  employee: {
    select: {
      id: true,
      organizationId: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

export type CurrentEmployeeUser = CurrentUser & {
  employeeId: string;
  employee: NonNullable<CurrentUser["employee"]>;
};

export async function getCurrentUser() {
  const userId = await readSessionUserId();

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: currentUserSelect,
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user?.isActive) {
    throw new Error("An active user account is required.");
  }

  return user;
}

export async function requireCurrentEmployeeUser(): Promise<CurrentEmployeeUser> {
  const user = await requireCurrentUser();

  if (!user.employeeId || !user.employee) {
    throw new Error("Your user account is not linked to an employee record.");
  }

  return {
    ...user,
    employeeId: user.employeeId,
    employee: user.employee,
  };
}
