"use server";

import { revalidatePath } from "next/cache";

import { OrganizationStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type OrganizationFormState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  errors?: Record<string, string>;
};

const validStatuses = new Set<string>(Object.values(OrganizationStatus));

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function validateEmail(value: string | null): boolean {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateWebsite(value: string | null): boolean {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function updateOrganization(
  _previousState: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_organization",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const id = textValue(formData, "id");
  const submittedVersion = Number(textValue(formData, "version"));

  const code = textValue(formData, "code").toUpperCase();
  const name = textValue(formData, "name");
  const shortName = nullableText(formData, "shortName");
  const legalName = nullableText(formData, "legalName");
  const email = nullableText(formData, "email");
  const phone = nullableText(formData, "phone");
  const website = nullableText(formData, "website");
  const status = textValue(formData, "status");
  const defaultTimeZone = textValue(formData, "defaultTimeZone");
  const defaultCurrency = textValue(formData, "defaultCurrency").toUpperCase();
  const defaultLanguage = textValue(formData, "defaultLanguage").toLowerCase();
  const dateFormat = textValue(formData, "dateFormat");
  const firstDayOfWeek = Number(textValue(formData, "firstDayOfWeek"));
  const isActive = formData.get("isActive") === "on";

  const errors: Record<string, string> = {};

  if (!id) {
    errors.id = "The Organization record could not be identified.";
  }

  if (!Number.isInteger(submittedVersion) || submittedVersion < 1) {
    errors.version = "The record version is invalid.";
  }

  if (!code) {
    errors.code = "Organization code is required.";
  } else if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
    errors.code = "Use 2–20 letters, numbers, hyphens or underscores.";
  }

  if (!name) {
    errors.name = "Organization name is required.";
  } else if (name.length > 160) {
    errors.name = "Organization name must not exceed 160 characters.";
  }

  if (shortName && shortName.length > 50) {
    errors.shortName = "Short name must not exceed 50 characters.";
  }

  if (legalName && legalName.length > 200) {
    errors.legalName = "Legal name must not exceed 200 characters.";
  }

  if (!validateEmail(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!validateWebsite(website)) {
    errors.website =
      "Enter a complete website address beginning with http:// or https://.";
  }

  if (!validStatuses.has(status)) {
    errors.status = "Select a valid Organization status.";
  }

  if (!defaultTimeZone) {
    errors.defaultTimeZone = "Time zone is required.";
  }

  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
    errors.defaultCurrency = "Enter a three-letter currency code.";
  }

  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(defaultLanguage)) {
    errors.defaultLanguage = "Use a language code such as en or en-TT.";
  }

  if (!dateFormat) {
    errors.dateFormat = "Date format is required.";
  }

  if (
    !Number.isInteger(firstDayOfWeek) ||
    firstDayOfWeek < 0 ||
    firstDayOfWeek > 6
  ) {
    errors.firstDayOfWeek = "Select a valid first day of the week.";
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
      const current = await transaction.organization.findUnique({
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

      const duplicateCode = await transaction.organization.findFirst({
        where: {
          code,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicateCode) {
        return {
          outcome: "duplicate-code" as const,
        };
      }

      const updateResult = await transaction.organization.updateMany({
        where: {
          id,
          version: submittedVersion,
        },
        data: {
          code,
          name,
          shortName,
          legalName,
          email,
          phone,
          website,
          status: status as OrganizationStatus,
          defaultTimeZone,
          defaultCurrency,
          defaultLanguage,
          dateFormat,
          firstDayOfWeek,
          isActive,
          archivedAt:
            status === OrganizationStatus.ARCHIVED
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

      const updated = await transaction.organization.findUniqueOrThrow({
        where: {
          id,
        },
      });

      await transaction.applicationSetting.updateMany({
        data: {
          organizationName: updated.name,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "administration",
          action: "UPDATE",
          entityType: "Organization",
          entityId: updated.id,
          description: `Updated Organization profile for ${updated.name}.`,
          oldValues: {
            code: current.code,
            name: current.name,
            shortName: current.shortName,
            legalName: current.legalName,
            email: current.email,
            phone: current.phone,
            website: current.website,
            status: current.status,
            defaultTimeZone: current.defaultTimeZone,
            defaultCurrency: current.defaultCurrency,
            defaultLanguage: current.defaultLanguage,
            dateFormat: current.dateFormat,
            firstDayOfWeek: current.firstDayOfWeek,
            isActive: current.isActive,
            version: current.version,
          },
          newValues: {
            code: updated.code,
            name: updated.name,
            shortName: updated.shortName,
            legalName: updated.legalName,
            email: updated.email,
            phone: updated.phone,
            website: updated.website,
            status: updated.status,
            defaultTimeZone: updated.defaultTimeZone,
            defaultCurrency: updated.defaultCurrency,
            defaultLanguage: updated.defaultLanguage,
            dateFormat: updated.dateFormat,
            firstDayOfWeek: updated.firstDayOfWeek,
            isActive: updated.isActive,
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
        message: "The Organization record no longer exists.",
      };
    }

    if (result.outcome === "conflict") {
      return {
        status: "conflict",
        message:
          "This Organization was updated elsewhere. Refresh the page before saving again.",
      };
    }

    if (result.outcome === "duplicate-code") {
      return {
        status: "error",
        message: "That Organization code is already in use.",
        errors: {
          code: "Choose a different Organization code.",
        },
      };
    }

    revalidatePath("/");
    revalidatePath("/administration");
    revalidatePath("/administration/organization");

    return {
      status: "success",
      message: "Organization profile saved successfully.",
    };
  } catch (error: unknown) {
    console.error("Unable to update Organization:", error);

    return {
      status: "error",
      message:
        "The Organization could not be saved. Check the server log and try again.",
    };
  }
}
