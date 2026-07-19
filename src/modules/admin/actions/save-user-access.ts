"use server";

import { revalidatePath } from "next/cache";

import { UserAccountStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ADMINISTRATOR_PROTECTION_MESSAGE,
  isDefaultAdministratorUser,
} from "@/src/modules/admin/lib/protected-administrator";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { buildEmployeeUserEmail } from "@/src/modules/auth/lib/employee-login-email";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type UserAccessFormState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  errors?: Record<string, string>;
};

const validStatuses = new Set<string>(Object.values(UserAccountStatus));

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveUserAccess(
  _previousState: UserAccessFormState,
  formData: FormData,
): Promise<UserAccessFormState> {
  const actor = await requireActor(
    "administration.manage",
    "identity.user.update",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const id = textValue(formData, "id");
  const submittedVersion = Number(textValue(formData, "version"));

  const firstName = textValue(formData, "firstName");
  const lastName = textValue(formData, "lastName");
  const email = textValue(formData, "email").toLowerCase();
  const status = textValue(formData, "status");
  const isActive = formData.get("isActive") === "on";
  const employeeIdValue = textValue(formData, "employeeId");
  const employeeId = employeeIdValue.length > 0 ? employeeIdValue : null;

  const errors: Record<string, string> = {};

  if (!id) {
    errors.id = "The user could not be identified.";
  }

  if (!Number.isInteger(submittedVersion) || submittedVersion < 1) {
    errors.version = "The user record version is invalid.";
  }

  if (!firstName) {
    errors.firstName = "First name is required.";
  }

  if (!lastName) {
    errors.lastName = "Last name is required.";
  }

  if (!email) {
    errors.email = "Email address is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!validStatuses.has(status)) {
    errors.status = "Select a valid account status.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Review the highlighted fields and try again.",
      errors,
    };
  }

  try {
    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.user.findUnique({
        where: {
          id,
        },
      });

      if (!current) {
        return {
          outcome: "missing" as const,
        };
      }

      if (current.version !== submittedVersion) {
        return {
          outcome: "conflict" as const,
        };
      }

      if (isDefaultAdministratorUser(current)) {
        if (status === UserAccountStatus.ARCHIVED) {
          return {
            outcome: "protected-administrator" as const,
          };
        }

        if (!isActive) {
          return {
            outcome: "protected-administrator" as const,
          };
        }

        if (
          status === UserAccountStatus.DISABLED ||
          status === UserAccountStatus.SUSPENDED
        ) {
          return {
            outcome: "protected-administrator" as const,
          };
        }

        if (email !== current.email) {
          return {
            outcome: "protected-administrator-email" as const,
          };
        }
      }

      let loginEmail = email;

      if (employeeId) {
        const employee = await transaction.employee.findFirst({
          where: {
            id: employeeId,
            organizationId: current.organizationId,
            isArchived: false,
          },
          select: {
            id: true,
            personalEmail: true,
            user: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!employee) {
          return {
            outcome: "invalid-employee" as const,
          };
        }

        if (employee.user && employee.user.id !== id) {
          return {
            outcome: "employee-linked" as const,
          };
        }

        try {
          loginEmail = buildEmployeeUserEmail(employee);
        } catch {
          return {
            outcome: "employee-personal-email-required" as const,
          };
        }
      }

      if (
        isDefaultAdministratorUser(current) &&
        loginEmail !== current.email
      ) {
        return {
          outcome: "protected-administrator-email" as const,
        };
      }

      const duplicateEmail = await transaction.user.findFirst({
        where: {
          email: loginEmail,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicateEmail) {
        return {
          outcome: "duplicate-email" as const,
        };
      }

      const updateResult = await transaction.user.updateMany({
        where: {
          id,
          version: submittedVersion,
        },
        data: {
          firstName,
          lastName,
          email: loginEmail,
          status: status as UserAccountStatus,
          isActive,
          employeeId,
          lockedUntil:
            status === UserAccountStatus.LOCKED ? current.lockedUntil : null,
          failedLoginAttempts:
            status === UserAccountStatus.ACTIVE
              ? 0
              : current.failedLoginAttempts,
          archivedAt:
            status === UserAccountStatus.ARCHIVED
              ? (current.archivedAt ?? new Date())
              : null,
          version: {
            increment: 1,
          },
        },
      });

      if (updateResult.count !== 1) {
        return {
          outcome: "conflict" as const,
        };
      }

      const updated = await transaction.user.findUniqueOrThrow({
        where: {
          id,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "identity",
          action: "UPDATE",
          entityType: "User",
          entityId: updated.id,
          description: `Updated user account for ${updated.firstName} ${updated.lastName}.`,
          oldValues: {
            firstName: current.firstName,
            lastName: current.lastName,
            email: current.email,
            status: current.status,
            isActive: current.isActive,
            employeeId: current.employeeId,
            failedLoginAttempts: current.failedLoginAttempts,
            lockedUntil: current.lockedUntil,
            version: current.version,
          },
          newValues: {
            firstName: updated.firstName,
            lastName: updated.lastName,
            email: updated.email,
            status: updated.status,
            isActive: updated.isActive,
            employeeId: updated.employeeId,
            failedLoginAttempts: updated.failedLoginAttempts,
            lockedUntil: updated.lockedUntil,
            version: updated.version,
          },
          ipAddress,
          userAgent,
          clientHostName,
        },
      });

      return {
        outcome: "updated" as const,
      };
    });

    if (result.outcome === "missing") {
      return {
        status: "error",
        message: "The user account no longer exists.",
      };
    }

    if (result.outcome === "conflict") {
      return {
        status: "conflict",
        message:
          "This user account was updated elsewhere. Refresh the page before saving again.",
      };
    }

    if (result.outcome === "protected-administrator") {
      return {
        status: "error",
        message: DEFAULT_ADMINISTRATOR_PROTECTION_MESSAGE,
      };
    }

    if (result.outcome === "protected-administrator-email") {
      return {
        status: "error",
        message:
          "The default system administrator login email cannot be changed.",
        errors: {
          email: "This account must keep admin@q-nxus.local.",
        },
      };
    }

    if (result.outcome === "duplicate-email") {
      return {
        status: "error",
        message: "That email address is already in use.",
        errors: {
          email: "Enter a different email address.",
        },
      };
    }

    if (result.outcome === "invalid-employee") {
      return {
        status: "error",
        message: "The selected employee record is invalid.",
        errors: {
          employeeId: "Select a valid employee.",
        },
      };
    }

    if (result.outcome === "employee-linked") {
      return {
        status: "error",
        message: "That employee is already linked to another user account.",
        errors: {
          employeeId: "Choose a different employee.",
        },
      };
    }

    if (result.outcome === "employee-personal-email-required") {
      return {
        status: "error",
        message:
          "The linked employee needs a personal email before it can be used as the login email.",
        errors: {
          employeeId:
            "Add a personal email on the employee record, then save access again.",
        },
      };
    }

    revalidatePath("/administration/access");
    revalidatePath(`/administration/access/users/${id}`);
    revalidatePath("/people/leave");

    return {
      status: "success",
      message: "User account saved successfully.",
    };
  } catch (error: unknown) {
    console.error("Unable to save user account:", error);

    return {
      status: "error",
      message:
        "The user account could not be saved. Check the server log and try again.",
    };
  }
}
