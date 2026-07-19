"use server";

/**
 * DEPRECATED — BusinessUnit admin UI routes were removed. Schema + this action
 * remain quarantined for possible future org hierarchy work. Do not rewire nav
 * or restore save pages without an explicit product decision. Prefer Department
 * under People → Organization for day-to-day structure.
 */

import { revalidatePath } from "next/cache";

import { ConfigurationStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type BusinessUnitFormState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  errors?: Record<string, string>;
  redirectTo?: string;
};

const validStatuses = new Set<string>(Object.values(ConfigurationStatus));

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

async function createsHierarchyCycle(
  businessUnitId: string,
  proposedParentId: string,
): Promise<boolean> {
  let currentId: string | null = proposedParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === businessUnitId) {
      return true;
    }

    if (visited.has(currentId)) {
      return true;
    }

    visited.add(currentId);

    const current: { parentId: string | null } | null =
      await prisma.businessUnit.findUnique({
        where: {
          id: currentId,
        },
        select: {
          parentId: true,
        },
      });

    currentId = current?.parentId ?? null;
  }

  return false;
}

export async function saveBusinessUnit(
  _previousState: BusinessUnitFormState,
  formData: FormData,
): Promise<BusinessUnitFormState> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_business_unit",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const id = textValue(formData, "id");
  const submittedUpdatedAt = textValue(formData, "updatedAt");

  const parentId = nullableText(formData, "parentId");
  const code = textValue(formData, "code").toUpperCase();
  const name = textValue(formData, "name");
  const description = nullableText(formData, "description");
  const status = textValue(formData, "status");
  const effectiveFromText = textValue(formData, "effectiveFrom");
  const effectiveUntilText = textValue(formData, "effectiveUntil");

  const effectiveFrom = parseDate(effectiveFromText);
  const effectiveUntil = parseDate(effectiveUntilText);

  const errors: Record<string, string> = {};

  if (!code) {
    errors.code = "Business Unit code is required.";
  } else if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
    errors.code = "Use 2–30 letters, numbers, hyphens or underscores.";
  }

  if (!name) {
    errors.name = "Business Unit name is required.";
  } else if (name.length > 160) {
    errors.name = "Name must not exceed 160 characters.";
  }

  if (description && description.length > 1000) {
    errors.description = "Description must not exceed 1,000 characters.";
  }

  if (!validStatuses.has(status)) {
    errors.status = "Select a valid status.";
  }

  if (!effectiveFrom) {
    errors.effectiveFrom = "Enter a valid effective-from date.";
  }

  if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) {
    errors.effectiveUntil = "Effective-until cannot be before effective-from.";
  }

  if (id && parentId === id) {
    errors.parentId = "A Business Unit cannot be its own parent.";
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

    if (parentId) {
      const parent = await prisma.businessUnit.findFirst({
        where: {
          id: parentId,
          organizationId: organization.id,
        },
        select: {
          id: true,
        },
      });

      if (!parent) {
        return {
          status: "error",
          message: "The selected parent Business Unit is invalid.",
          errors: {
            parentId: "Select a valid parent Business Unit.",
          },
        };
      }

      if (id && (await createsHierarchyCycle(id, parentId))) {
        return {
          status: "error",
          message: "The selected parent would create a circular hierarchy.",
          errors: {
            parentId:
              "Choose a parent outside this Business Unit's descendant hierarchy.",
          },
        };
      }
    }

    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      const duplicate = await transaction.businessUnit.findFirst({
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
        const created = await transaction.businessUnit.create({
          data: {
            organizationId: organization.id,
            parentId,
            code,
            name,
            description,
            status: status as ConfigurationStatus,
            effectiveFrom: effectiveFrom!,
            effectiveUntil,
          },
        });

        await transaction.auditEvent.create({
          data: {
            userId: actor.actor.userId,
            moduleKey: "administration",
            action: "CREATE",
            entityType: "BusinessUnit",
            entityId: created.id,
            description: `Created Business Unit ${created.name}.`,
            newValues: {
              parentId: created.parentId,
              code: created.code,
              name: created.name,
              description: created.description,
              status: created.status,
              effectiveFrom: created.effectiveFrom,
              effectiveUntil: created.effectiveUntil,
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

      const current = await transaction.businessUnit.findUnique({
        where: {
          id,
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

      const updateResult = await transaction.businessUnit.updateMany({
        where: {
          id,
          updatedAt: current.updatedAt,
        },
        data: {
          parentId,
          code,
          name,
          description,
          status: status as ConfigurationStatus,
          effectiveFrom: effectiveFrom!,
          effectiveUntil,
        },
      });

      if (updateResult.count !== 1) {
        return {
          outcome: "conflict" as const,
        };
      }

      const updated = await transaction.businessUnit.findUniqueOrThrow({
        where: {
          id,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "administration",
          action: "UPDATE",
          entityType: "BusinessUnit",
          entityId: updated.id,
          description: `Updated Business Unit ${updated.name}.`,
          oldValues: {
            parentId: current.parentId,
            code: current.code,
            name: current.name,
            description: current.description,
            status: current.status,
            effectiveFrom: current.effectiveFrom,
            effectiveUntil: current.effectiveUntil,
          },
          newValues: {
            parentId: updated.parentId,
            code: updated.code,
            name: updated.name,
            description: updated.description,
            status: updated.status,
            effectiveFrom: updated.effectiveFrom,
            effectiveUntil: updated.effectiveUntil,
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
        message: "That Business Unit code is already in use.",
        errors: {
          code: "Choose a different Business Unit code.",
        },
      };
    }

    if (result.outcome === "missing") {
      return {
        status: "error",
        message: "The Business Unit no longer exists.",
      };
    }

    if (result.outcome === "conflict") {
      return {
        status: "conflict",
        message:
          "This Business Unit was updated elsewhere. Refresh the page before saving again.",
      };
    }

    revalidatePath("/administration/business-units");
    revalidatePath(`/administration/business-units/${result.id}`);

    return {
      status: "success",
      message:
        result.outcome === "created"
          ? "Business Unit created successfully."
          : "Business Unit updated successfully.",
      redirectTo: "/administration/business-units",
    };
  } catch (error: unknown) {
    console.error("Unable to save Business Unit:", error);

    return {
      status: "error",
      message:
        "The Business Unit could not be saved. Check the server log and try again.",
    };
  }
}
