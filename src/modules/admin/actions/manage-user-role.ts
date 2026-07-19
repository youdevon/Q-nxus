"use server";

import { revalidatePath } from "next/cache";

import { RoleAssignmentStatus, UserRoleSource } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ADMINISTRATOR_PROTECTION_MESSAGE,
  isDefaultAdministratorUser,
} from "@/src/modules/admin/lib/protected-administrator";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";

export type RoleAssignmentState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function assignUserRole(
  _previousState: RoleAssignmentState,
  formData: FormData,
): Promise<RoleAssignmentState> {
  const actor = await requireActor(
    "administration.manage",
    "identity.user.update",
    "identity.role.manage",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const userId = textValue(formData, "userId");
  const roleId = textValue(formData, "roleId");
  const reason = nullableText(formData, "reason");
  const useEffectiveDates =
    textValue(formData, "useEffectiveDates").toLowerCase() === "true";

  // When dates are not set, start immediately with no end date.
  const effectiveFrom = useEffectiveDates
    ? parseDate(textValue(formData, "effectiveFrom"))
    : new Date();
  const effectiveUntil = useEffectiveDates
    ? parseDate(textValue(formData, "effectiveUntil"))
    : null;

  const errors: Record<string, string> = {};

  if (!userId) {
    errors.userId = "The user could not be identified.";
  }

  if (!roleId) {
    errors.roleId = "Select a role.";
  }

  if (useEffectiveDates && !effectiveFrom) {
    errors.effectiveFrom = "Enter a valid effective-from date.";
  }

  if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) {
    errors.effectiveUntil = "Effective-until cannot be before effective-from.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Review the role assignment details.",
      errors,
    };
  }

  try {
    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          organizationId: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!user) {
        return {
          outcome: "missing-user" as const,
        };
      }

      const role = await transaction.role.findFirst({
        where: {
          id: roleId,
          isActive: true,
          OR: [
            {
              organizationId: user.organizationId,
            },
            {
              organizationId: null,
            },
          ],
        },
      });

      if (!role) {
        return {
          outcome: "invalid-role" as const,
        };
      }

      const duplicate = await transaction.userRole.findFirst({
        where: {
          userId,
          roleId,
          status: {
            in: [RoleAssignmentStatus.PENDING, RoleAssignmentStatus.ACTIVE],
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        return {
          outcome: "duplicate" as const,
        };
      }

      const assignment = await transaction.userRole.create({
        data: {
          userId,
          roleId,
          status: RoleAssignmentStatus.ACTIVE,
          effectiveFrom: effectiveFrom!,
          effectiveUntil,
          reason,
          source: UserRoleSource.MANUAL,
        },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        moduleKey: "identity",
        action: "ASSIGN_ROLE",
        entityType: "UserRole",
        entityId: assignment.id,
        description: `Assigned role ${role.name} to ${user.firstName} ${user.lastName}.`,
        newValues: {
          userId,
          roleId,
          roleCode: role.code,
          status: assignment.status,
          effectiveFrom: assignment.effectiveFrom,
          effectiveUntil: assignment.effectiveUntil,
          reason: assignment.reason,
          source: assignment.source,
        },
        ipAddress,
        userAgent,
        clientHostName,
      });

      return {
        outcome: "assigned" as const,
      };
    });

    if (result.outcome === "missing-user") {
      return {
        status: "error",
        message: "The user account no longer exists.",
      };
    }

    if (result.outcome === "invalid-role") {
      return {
        status: "error",
        message: "The selected role is unavailable.",
      };
    }

    if (result.outcome === "duplicate") {
      return {
        status: "error",
        message:
          "This user already has an active or pending assignment for that role.",
      };
    }

    revalidatePath("/administration/access");
    revalidatePath(`/administration/access/users/${userId}`);
    revalidatePath(`/administration/access/users/${userId}/edit`);

    return {
      status: "success",
      message: "Role assigned successfully.",
    };
  } catch (error: unknown) {
    console.error("Unable to assign role:", error);

    return {
      status: "error",
      message:
        "The role could not be assigned. Check the server log and try again.",
    };
  }
}

export async function revokeUserRole(
  _previousState: RoleAssignmentState,
  formData: FormData,
): Promise<RoleAssignmentState> {
  const actor = await requireActor(
    "administration.manage",
    "identity.user.update",
    "identity.role.manage",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const assignmentId = textValue(formData, "assignmentId");
  const userId = textValue(formData, "userId");
  const reason =
    nullableText(formData, "revocationReason") ?? "Revoked by administrator.";

  if (!assignmentId || !userId) {
    return {
      status: "error",
      message: "The role assignment could not be identified.",
    };
  }

  try {
    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.userRole.findUnique({
        where: {
          id: assignmentId,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          role: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      });

      if (
        !current ||
        current.userId !== userId ||
        current.status === RoleAssignmentStatus.REVOKED
      ) {
        return {
          outcome: "missing" as const,
        };
      }

      if (
        current.role.code === "SYSTEM_ADMINISTRATOR" &&
        isDefaultAdministratorUser({
          id: current.userId,
          email: current.user.email,
        })
      ) {
        return {
          outcome: "protected-administrator" as const,
        };
      }

      const updated = await transaction.userRole.update({
        where: {
          id: assignmentId,
        },
        data: {
          status: RoleAssignmentStatus.REVOKED,
          revokedAt: new Date(),
          effectiveUntil: current.effectiveUntil ?? new Date(),
          reason,
        },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        moduleKey: "identity",
        action: "REVOKE_ROLE",
        entityType: "UserRole",
        entityId: updated.id,
        description: `Revoked role ${current.role.name} from ${current.user.firstName} ${current.user.lastName}.`,
        oldValues: {
          status: current.status,
          effectiveUntil: current.effectiveUntil,
          revokedAt: current.revokedAt,
          reason: current.reason,
          source: current.source,
        },
        newValues: {
          status: updated.status,
          effectiveUntil: updated.effectiveUntil,
          revokedAt: updated.revokedAt,
          reason: updated.reason,
          source: updated.source,
        },
        ipAddress,
        userAgent,
        clientHostName,
      });

      return {
        outcome: "revoked" as const,
      };
    });

    if (result.outcome === "missing") {
      return {
        status: "error",
        message: "The role assignment no longer exists.",
      };
    }

    if (result.outcome === "protected-administrator") {
      return {
        status: "error",
        message: DEFAULT_ADMINISTRATOR_PROTECTION_MESSAGE,
      };
    }

    revalidatePath("/administration/access");
    revalidatePath(`/administration/access/users/${userId}`);
    revalidatePath(`/administration/access/users/${userId}/edit`);

    return {
      status: "success",
      message: "Role revoked successfully.",
    };
  } catch (error: unknown) {
    console.error("Unable to revoke role:", error);

    return {
      status: "error",
      message:
        "The role could not be revoked. Check the server log and try again.",
    };
  }
}
