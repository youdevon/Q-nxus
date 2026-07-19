"use server";

/**
 * DEPRECATED — Location admin UI routes were removed. Schema + this action
 * remain quarantined. Do not rewire nav or restore save pages without an
 * explicit product decision.
 */

import { revalidatePath } from "next/cache";

import { ConfigurationStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type LocationFormState = {
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

export async function saveLocation(
  _previousState: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_location",
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
  const locationType = textValue(formData, "locationType");
  const addressLine1 = nullableText(formData, "addressLine1");
  const addressLine2 = nullableText(formData, "addressLine2");
  const city = nullableText(formData, "city");
  const region = nullableText(formData, "region");
  const countryCode = textValue(formData, "countryCode").toUpperCase();
  const postalCode = nullableText(formData, "postalCode");
  const timeZone = textValue(formData, "timeZone");
  const status = textValue(formData, "status");
  const effectiveFromText = textValue(formData, "effectiveFrom");
  const effectiveUntilText = textValue(formData, "effectiveUntil");

  const effectiveFrom = parseDate(effectiveFromText);
  const effectiveUntil = parseDate(effectiveUntilText);

  const errors: Record<string, string> = {};

  if (!code) {
    errors.code = "Location code is required.";
  } else if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
    errors.code = "Use 2–30 letters, numbers, hyphens or underscores.";
  }

  if (!name) {
    errors.name = "Location name is required.";
  } else if (name.length > 160) {
    errors.name = "Location name must not exceed 160 characters.";
  }

  if (!locationType) {
    errors.locationType = "Location type is required.";
  }

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    errors.countryCode = "Enter a two-letter country code.";
  }

  if (!timeZone) {
    errors.timeZone = "Time zone is required.";
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

    const result = await prisma.$transaction(async (transaction) => {
      const duplicate = await transaction.location.findFirst({
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
        const created = await transaction.location.create({
          data: {
            organizationId: organization.id,
            code,
            name,
            locationType,
            addressLine1,
            addressLine2,
            city,
            region,
            countryCode,
            postalCode,
            timeZone,
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
            entityType: "Location",
            entityId: created.id,
            description: `Created location ${created.name}.`,
            newValues: {
              code: created.code,
              name: created.name,
              locationType: created.locationType,
              city: created.city,
              region: created.region,
              countryCode: created.countryCode,
              timeZone: created.timeZone,
              status: created.status,
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

      const current = await transaction.location.findUnique({
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

      const updateResult = await transaction.location.updateMany({
        where: {
          id,
          updatedAt: current.updatedAt,
        },
        data: {
          code,
          name,
          locationType,
          addressLine1,
          addressLine2,
          city,
          region,
          countryCode,
          postalCode,
          timeZone,
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

      const updated = await transaction.location.findUniqueOrThrow({
        where: {
          id,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "administration",
          action: "UPDATE",
          entityType: "Location",
          entityId: updated.id,
          description: `Updated location ${updated.name}.`,
          oldValues: {
            code: current.code,
            name: current.name,
            locationType: current.locationType,
            addressLine1: current.addressLine1,
            addressLine2: current.addressLine2,
            city: current.city,
            region: current.region,
            countryCode: current.countryCode,
            postalCode: current.postalCode,
            timeZone: current.timeZone,
            status: current.status,
            effectiveFrom: current.effectiveFrom,
            effectiveUntil: current.effectiveUntil,
          },
          newValues: {
            code: updated.code,
            name: updated.name,
            locationType: updated.locationType,
            addressLine1: updated.addressLine1,
            addressLine2: updated.addressLine2,
            city: updated.city,
            region: updated.region,
            countryCode: updated.countryCode,
            postalCode: updated.postalCode,
            timeZone: updated.timeZone,
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
        message: "That location code is already in use.",
        errors: {
          code: "Choose a different location code.",
        },
      };
    }

    if (result.outcome === "missing") {
      return {
        status: "error",
        message: "The location no longer exists.",
      };
    }

    if (result.outcome === "conflict") {
      return {
        status: "conflict",
        message:
          "This location was updated elsewhere. Refresh the page before saving again.",
      };
    }

    revalidatePath("/administration");
    revalidatePath("/administration/locations");
    revalidatePath(`/administration/locations/${result.id}`);

    return {
      status: "success",
      message:
        result.outcome === "created"
          ? "Location created successfully."
          : "Location updated successfully.",
      redirectTo: "/administration/locations",
    };
  } catch (error: unknown) {
    console.error("Unable to save location:", error);

    return {
      status: "error",
      message:
        "The location could not be saved. Check the server log and try again.",
    };
  }
}
