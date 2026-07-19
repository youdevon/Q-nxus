import { prisma } from "@/lib/prisma";
import { buildEmployeeUserEmail } from "@/src/modules/auth/lib/employee-login-email";
import {
  EmployeeLoginEmailConflictError,
  syncEmployeeUserLoginEmail,
} from "@/src/modules/auth/services/provision-employee-user";

export type EmployeeLoginEmailBackfillConflict = {
  userId: string;
  employeeId: string;
  currentEmail: string;
  personalEmail: string | null;
  reason: string;
};

export type EmployeeLoginEmailBackfillResult = {
  considered: number;
  alreadySynced: number;
  updated: number;
  skippedMissingPersonalEmail: number;
  conflicts: EmployeeLoginEmailBackfillConflict[];
};

export async function backfillEmployeeLoginEmails(): Promise<EmployeeLoginEmailBackfillResult> {
  const users = await prisma.user.findMany({
    where: {
      employeeId: {
        not: null,
      },
    },
    orderBy: [
      {
        lastName: "asc",
      },
      {
        firstName: "asc",
      },
    ],
    select: {
      id: true,
      email: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          personalEmail: true,
        },
      },
    },
  });

  const result: EmployeeLoginEmailBackfillResult = {
    considered: users.length,
    alreadySynced: 0,
    updated: 0,
    skippedMissingPersonalEmail: 0,
    conflicts: [],
  };

  for (const user of users) {
    const employee = user.employee;

    if (!user.employeeId || !employee) {
      continue;
    }

    let loginEmail: string;

    try {
      loginEmail = buildEmployeeUserEmail(employee);
    } catch (error) {
      result.skippedMissingPersonalEmail += 1;
      result.conflicts.push({
        userId: user.id,
        employeeId: user.employeeId,
        currentEmail: user.email,
        personalEmail: employee.personalEmail,
        reason:
          error instanceof Error
            ? error.message
            : "The employee personal email is missing.",
      });
      continue;
    }

    if (user.email === loginEmail) {
      result.alreadySynced += 1;
      continue;
    }

    try {
      const synced = await syncEmployeeUserLoginEmail(user.id, employee.id);

      if (synced.updated) {
        result.updated += 1;
      } else {
        result.alreadySynced += 1;
      }
    } catch (error) {
      result.conflicts.push({
        userId: user.id,
        employeeId: user.employeeId,
        currentEmail: user.email,
        personalEmail: employee.personalEmail,
        reason:
          error instanceof EmployeeLoginEmailConflictError ||
          error instanceof Error
            ? error.message
            : "The login email could not be synchronized.",
      });
    }
  }

  return result;
}
