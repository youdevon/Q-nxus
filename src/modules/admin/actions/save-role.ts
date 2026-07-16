"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type RoleFormState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  errors?: Record<string, string>;
  redirectTo?: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

export async function saveRole(
  _previousState: RoleFormState,
  formData: FormData,
): Promise<RoleFormState> {
  const actor = await requireActor(
    "administration.manage",
    "identity.role.manage",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const id = textValue(formData, "id");
  const submittedUpdatedAt = textValue(formData, "updatedAt");

  const code = textValue(formData, "code").toUpperCase();
  const name = textValue(formData, "name");
  const description = nullableText(formData, "description");
  const isActive = formData.get("isActive") === "on";

  const permissionIds = Array.from(
    new Set(
      formData
        .getAll("permissionIds")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  const errors: Record<string, string> = {};

  if (!code) {
    errors.code = "Role code is required.";
  } else if (!/^[A-Z0-9_.-]{2,50}$/.test(code)) {
    errors.code = "Use 2–50 letters, numbers, periods, hyphens or underscores.";
  }

  if (!name) {
    errors.name = "Role name is required.";
  } else if (name.length > 120) {
    errors.name = "Role name must not exceed 120 characters.";
  }

  if (description && description.length > 1000) {
    errors.description = "Description must not exceed 1,000 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Review the highlighted fields and try again.",
      errors,
    };
  }

  try {
    const organization = await prisma.organization.findFirst({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      return {
        status: "error",
        message: "No Organization is configured.",
      };
    }

    const validPermissions = await prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds,
        },
        isActive: true,
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (validPermissions.length !== permissionIds.length) {
      return {
        status: "error",
        message: "One or more selected permissions are no longer available.",
      };
    }

    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      const duplicate = await transaction.role.findFirst({
        where: {
          organizationId: organization.id,
          code,
          ...(id
            ? {
                id: {
                  not: id,
                },
              }
            : {}),
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

      if (!id) {
        const created = await transaction.role.create({
          data: {
            organizationId: organization.id,
            code,
            name,
            description,
            isSystem: false,
            isActive,
          },
        });

        if (validPermissions.length > 0) {
          await transaction.rolePermission.createMany({
            data: validPermissions.map((permission) => ({
              roleId: created.id,
              permissionId: permission.id,
            })),
          });
        }

        await transaction.auditEvent.create({
          data: {
            userId: actor.actor.userId,
            moduleKey: "identity",
            action: "CREATE",
            entityType: "Role",
            entityId: created.id,
            description: `Created role ${created.name}.`,
            newValues: {
              code: created.code,
              name: created.name,
              description: created.description,
              isSystem: created.isSystem,
              isActive: created.isActive,
              permissions: validPermissions.map(
                (permission) => permission.code,
              ),
            },
            ipAddress,
            userAgent,
            clientHostName,
          },
        });

        return {
          outcome: "created" as const,
          id: created.id,
        };
      }

      const current = await transaction.role.findUnique({
        where: {
          id,
        },
        include: {
          permissions: {
            include: {
              permission: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      });

      if (!current) {
        return {
          outcome: "missing" as const,
        };
      }

      if (
        !submittedUpdatedAt ||
        current.updatedAt.toISOString() !== submittedUpdatedAt
      ) {
        return {
          outcome: "conflict" as const,
        };
      }

      if (
        current.organizationId !== organization.id &&
        current.organizationId !== null
      ) {
        return {
          outcome: "forbidden" as const,
        };
      }

      const updateResult = await transaction.role.updateMany({
        where: {
          id,
          updatedAt: current.updatedAt,
        },
        data: {
          code: current.isSystem ? current.code : code,
          name,
          description,
          isActive,
        },
      });

      if (updateResult.count !== 1) {
        return {
          outcome: "conflict" as const,
        };
      }

      await transaction.rolePermission.deleteMany({
        where: {
          roleId: id,
        },
      });

      if (validPermissions.length > 0) {
        await transaction.rolePermission.createMany({
          data: validPermissions.map((permission) => ({
            roleId: id,
            permissionId: permission.id,
          })),
        });
      }

      const updated = await transaction.role.findUniqueOrThrow({
        where: {
          id,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "identity",
          action: "UPDATE",
          entityType: "Role",
          entityId: updated.id,
          description: `Updated role ${updated.name}.`,
          oldValues: {
            code: current.code,
            name: current.name,
            description: current.description,
            isSystem: current.isSystem,
            isActive: current.isActive,
            permissions: current.permissions.map(
              (entry) => entry.permission.code,
            ),
          },
          newValues: {
            code: updated.code,
            name: updated.name,
            description: updated.description,
            isSystem: updated.isSystem,
            isActive: updated.isActive,
            permissions: validPermissions.map((permission) => permission.code),
          },
          ipAddress,
          userAgent,
          clientHostName,
        },
      });

      return {
        outcome: "updated" as const,
        id: updated.id,
      };
    });

    if (result.outcome === "duplicate") {
      return {
        status: "error",
        message: "That role code is already in use.",
        errors: {
          code: "Choose a different role code.",
        },
      };
    }

    if (result.outcome === "missing") {
      return {
        status: "error",
        message: "The role no longer exists.",
      };
    }

    if (result.outcome === "forbidden") {
      return {
        status: "error",
        message: "This role does not belong to the current Organization.",
      };
    }

    if (result.outcome === "conflict") {
      return {
        status: "conflict",
        message:
          "This role was updated elsewhere. Refresh the page before saving again.",
      };
    }

    revalidatePath("/administration/access");
    revalidatePath(`/administration/access/roles/${result.id}`);

    return {
      status: "success",
      message:
        result.outcome === "created"
          ? "Role created successfully."
          : "Role updated successfully.",
      redirectTo: "/administration/access",
    };
  } catch (error: unknown) {
    console.error("Unable to save role:", error);

    return {
      status: "error",
      message:
        "The role could not be saved. Check the server log and try again.",
    };
  }
}
