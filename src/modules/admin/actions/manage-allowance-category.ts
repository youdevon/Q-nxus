"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type AllowanceCategoryFormState = {
  status: "idle" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function validateCategory(formData: FormData) {
  const name = textValue(formData, "name");
  const code = nullableText(formData, "code");
  const description = nullableText(formData, "description");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) {
    fieldErrors.name =
      "Allowance category name must contain at least two characters.";
  }

  if (code && code.length > 20) {
    fieldErrors.code = "Allowance code cannot exceed 20 characters.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    values: {
      name,
      code: code?.toUpperCase() ?? null,
      description,
      isTaxableDefault: formData.get("isTaxableDefault") === "on",
      includedInGratuityDefault:
        formData.get("includedInGratuityDefault") === "on",
      isActive: formData.get("isActive") === "on",
    },
  };
}

export async function createAllowanceCategory(
  _previousState: AllowanceCategoryFormState,
  formData: FormData,
): Promise<AllowanceCategoryFormState> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_reference_data",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const validation = validateCategory(formData);

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the allowance category information.",
      fieldErrors: validation.fieldErrors,
    };
  }

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
      message: "No organization is configured.",
    };
  }

  const duplicate = await prisma.allowanceCategory.findFirst({
    where: {
      organizationId: organization.id,
      name: {
        equals: validation.values.name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    return {
      status: "error",
      message: "An allowance category with this name already exists.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  try {
    const category = await prisma.$transaction(async (transaction) => {
      const created = await transaction.allowanceCategory.create({
        data: {
          organizationId: organization.id,
          ...validation.values,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "CREATE",
          entityType: "AllowanceCategory",
          entityId: created.id,
          description: `Created allowance category ${created.name}.`,
          newValues: {
            code: created.code,
            name: created.name,
            description: created.description,
            isTaxableDefault: created.isTaxableDefault,
            includedInGratuityDefault: created.includedInGratuityDefault,
            isActive: created.isActive,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return created;
    });

    revalidatePath("/administration/allowances");
    redirect(`/administration/allowances/${category.id}`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to create allowance category:", error);

    return {
      status: "error",
      message: "The allowance category could not be created.",
    };
  }
}

export async function updateAllowanceCategory(
  _previousState: AllowanceCategoryFormState,
  formData: FormData,
): Promise<AllowanceCategoryFormState> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_reference_data",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const id = textValue(formData, "id");
  const submittedUpdatedAt = textValue(formData, "updatedAt");
  const validation = validateCategory(formData);

  if (!id || !submittedUpdatedAt) {
    return {
      status: "error",
      message: "The allowance category record is incomplete.",
    };
  }

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the allowance category information.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const current = await prisma.allowanceCategory.findUnique({
    where: {
      id,
    },
  });

  if (!current) {
    return {
      status: "error",
      message: "The allowance category no longer exists.",
    };
  }

  if (current.updatedAt.toISOString() !== submittedUpdatedAt) {
    return {
      status: "conflict",
      message:
        "This allowance category was updated elsewhere. Refresh before saving.",
    };
  }

  const duplicate = await prisma.allowanceCategory.findFirst({
    where: {
      organizationId: current.organizationId,
      id: {
        not: id,
      },
      name: {
        equals: validation.values.name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    return {
      status: "error",
      message: "An allowance category with this name already exists.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.allowanceCategory.updateMany({
        where: {
          id,
          updatedAt: current.updatedAt,
        },
        data: validation.values,
      });

      if (updateResult.count !== 1) {
        return false;
      }

      const updated = await transaction.allowanceCategory.findUniqueOrThrow({
        where: {
          id,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "AllowanceCategory",
          entityId: updated.id,
          description: `Updated allowance category ${updated.name}.`,
          oldValues: {
            code: current.code,
            name: current.name,
            description: current.description,
            isTaxableDefault: current.isTaxableDefault,
            includedInGratuityDefault: current.includedInGratuityDefault,
            isActive: current.isActive,
          },
          newValues: {
            code: updated.code,
            name: updated.name,
            description: updated.description,
            isTaxableDefault: updated.isTaxableDefault,
            includedInGratuityDefault: updated.includedInGratuityDefault,
            isActive: updated.isActive,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return true;
    });

    if (!result) {
      return {
        status: "conflict",
        message: "The allowance category changed while being saved.",
      };
    }

    revalidatePath("/administration/allowances");
    revalidatePath(`/administration/allowances/${id}`);
    revalidatePath(`/administration/allowances/${id}/edit`);

    redirect(`/administration/allowances/${id}`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to update allowance category:", error);

    return {
      status: "error",
      message: "The allowance category could not be updated.",
    };
  }
}
