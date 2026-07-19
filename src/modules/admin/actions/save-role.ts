"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { resolveRoleCode } from "@/src/modules/admin/lib/role-code";
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

  const name = textValue(formData, "name");
  const description = nullableText(formData, "description");
  const isActive = formData.get("isActive") === "on";
  const codeInput = textValue(formData, "code");

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

  if (!name) {
    errors.name = "Role name is required.";
  } else if (name.length > 120) {
    errors.name = "Role name must not exceed 120 characters.";
  }

  const code = resolveRoleCode({
    code: codeInput,
    name,
  });

  if (!code) {
    errors.code = codeInput
      ? "Use 2–50 letters, numbers, periods, hyphens or underscores."
      : "Enter a role code, or a name that can be converted into one.";
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
          code: code!,
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
            code: code!,
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

      if (current.isSystem) {
        return {
          outcome: "system-protected" as const,
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
          isSystem: false,
        },
        data: {
          code: code!,
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

    if (result.outcome === "system-protected") {
      return {
        status: "error",
        message:
          "Built-in system roles cannot be edited. Duplicate the role as a custom role instead.",
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
      redirectTo: `/administration/access/roles/${result.id}`,
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

export type DeleteRoleState = {
  status: "idle" | "success" | "error";
  message: string;
  redirectTo?: string;
};

export async function deleteRole(
  _previousState: DeleteRoleState,
  formData: FormData,
): Promise<DeleteRoleState> {
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

  if (!id) {
    return {
      status: "error",
      message: "The role could not be identified.",
    };
  }

  try {
    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          code: true,
          name: true,
          isSystem: true,
          _count: {
            select: {
              users: {
                where: {
                  status: {
                    in: ["ACTIVE", "PENDING"],
                  },
                },
              },
            },
          },
        },
      });

      if (!role) {
        return {
          outcome: "missing" as const,
        };
      }

      if (role.isSystem) {
        return {
          outcome: "system-protected" as const,
        };
      }

      if (role._count.users > 0) {
        return {
          outcome: "assigned" as const,
          assignmentCount: role._count.users,
        };
      }

      await transaction.rolePermission.deleteMany({
        where: {
          roleId: id,
        },
      });

      await transaction.role.delete({
        where: {
          id,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "identity",
          action: "DELETE",
          entityType: "Role",
          entityId: role.id,
          description: `Deleted role ${role.name}.`,
          oldValues: {
            code: role.code,
            name: role.name,
          },
          ipAddress,
          userAgent,
          clientHostName,
        },
      });

      return {
        outcome: "deleted" as const,
      };
    });

    if (result.outcome === "missing") {
      return {
        status: "error",
        message: "The role no longer exists.",
      };
    }

    if (result.outcome === "system-protected") {
      return {
        status: "error",
        message: "Built-in system roles cannot be deleted.",
      };
    }

    if (result.outcome === "assigned") {
      return {
        status: "error",
        message: `This role is assigned to ${result.assignmentCount} user${result.assignmentCount === 1 ? "" : "s"}. Revoke those assignments before deleting.`,
      };
    }

    revalidatePath("/administration/access");

    return {
      status: "success",
      message: "Role deleted successfully.",
      redirectTo: "/administration/access",
    };
  } catch (error: unknown) {
    console.error("Unable to delete role:", error);

    return {
      status: "error",
      message:
        "The role could not be deleted. Check the server log and try again.",
    };
  }
}

export type DuplicateRoleState = {
  status: "idle" | "success" | "error";
  message: string;
  redirectTo?: string;
};

export async function duplicateRoleAsCustom(
  _previousState: DuplicateRoleState,
  formData: FormData,
): Promise<DuplicateRoleState> {
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

  const sourceId = textValue(formData, "sourceId");

  if (!sourceId) {
    return {
      status: "error",
      message: "The source role could not be identified.",
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

    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      const source = await transaction.role.findFirst({
        where: {
          id: sourceId,
          OR: [
            {
              organizationId: organization.id,
            },
            {
              organizationId: null,
            },
          ],
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          permissions: {
            select: {
              permissionId: true,
              permission: {
                select: {
                  code: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!source) {
        return {
          outcome: "missing" as const,
        };
      }

      const baseCode = resolveRoleCode({
        code: `${source.code}_CUSTOM`,
        name: `${source.name} (custom)`,
      });

      if (!baseCode) {
        return {
          outcome: "invalid-code" as const,
        };
      }

      let code = baseCode;
      let suffix = 2;

      while (
        await transaction.role.findFirst({
          where: {
            organizationId: organization.id,
            code,
          },
          select: {
            id: true,
          },
        })
      ) {
        const candidate = `${baseCode}_${suffix}`.slice(0, 50);
        code = candidate;
        suffix += 1;

        if (suffix > 100) {
          return {
            outcome: "duplicate" as const,
          };
        }
      }

      const created = await transaction.role.create({
        data: {
          organizationId: organization.id,
          code,
          name: `${source.name} (custom)`,
          description: source.description,
          isSystem: false,
          isActive: true,
        },
      });

      const activePermissions = source.permissions.filter(
        (entry) => entry.permission.isActive,
      );

      if (activePermissions.length > 0) {
        await transaction.rolePermission.createMany({
          data: activePermissions.map((entry) => ({
            roleId: created.id,
            permissionId: entry.permissionId,
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
          description: `Duplicated role ${source.name} as custom role ${created.name}.`,
          newValues: {
            code: created.code,
            name: created.name,
            description: created.description,
            isSystem: false,
            sourceRoleId: source.id,
            sourceRoleCode: source.code,
            permissions: activePermissions.map(
              (entry) => entry.permission.code,
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
    });

    if (result.outcome === "missing") {
      return {
        status: "error",
        message: "The source role no longer exists.",
      };
    }

    if (result.outcome === "invalid-code" || result.outcome === "duplicate") {
      return {
        status: "error",
        message:
          "A unique custom role code could not be generated. Create a new role manually.",
      };
    }

    revalidatePath("/administration/access");
    revalidatePath(`/administration/access/roles/${result.id}`);

    return {
      status: "success",
      message: "Custom role created from the selected template.",
      redirectTo: `/administration/access/roles/${result.id}/edit`,
    };
  } catch (error: unknown) {
    console.error("Unable to duplicate role:", error);

    return {
      status: "error",
      message:
        "The role could not be duplicated. Check the server log and try again.",
    };
  }
}
