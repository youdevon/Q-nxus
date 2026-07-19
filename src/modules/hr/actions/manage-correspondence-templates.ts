"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CorrespondenceCategory } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  defaultRequiresAcknowledgement,
  isCorrespondenceCategory,
  isRestrictedCategory,
} from "@/src/modules/hr/lib/correspondence-visibility";

export type TemplateFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function checkboxValue(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

async function resolveOrganizationId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

function parseTemplateFields(formData: FormData): {
  fieldErrors: Record<string, string>;
  name: string;
  category: CorrespondenceCategory | null;
  defaultTitle: string;
  body: string;
  employeeVisible: boolean;
  requiresAcknowledgement: boolean;
  allowsEmployeeResponse: boolean;
} {
  const name = textValue(formData, "name");
  const categoryValue = textValue(formData, "category");
  const defaultTitle = textValue(formData, "defaultTitle");
  const body = textValue(formData, "body");
  const employeeVisible = checkboxValue(formData, "employeeVisible");
  const requiresAcknowledgement = checkboxValue(
    formData,
    "requiresAcknowledgement",
  );
  const allowsEmployeeResponse = checkboxValue(
    formData,
    "allowsEmployeeResponse",
  );

  const fieldErrors: Record<string, string> = {};
  let category: CorrespondenceCategory | null = null;

  if (name.length < 2) {
    fieldErrors.name = "Enter a template name.";
  }

  if (!isCorrespondenceCategory(categoryValue)) {
    fieldErrors.category = "Select a valid category.";
  } else {
    category = categoryValue;
  }

  if (defaultTitle.length < 2) {
    fieldErrors.defaultTitle = "Enter a default title.";
  }

  if (body.length < 2) {
    fieldErrors.body = "Enter template body text.";
  }

  return {
    fieldErrors,
    name,
    category,
    defaultTitle,
    body,
    employeeVisible: isRestrictedCategory(categoryValue as CorrespondenceCategory)
      ? false
      : employeeVisible,
    requiresAcknowledgement:
      category && isCorrespondenceCategory(category)
        ? requiresAcknowledgement || defaultRequiresAcknowledgement(category)
        : requiresAcknowledgement,
    allowsEmployeeResponse,
  };
}

export async function createCorrespondenceTemplate(
  _previousState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const parsed = parseTemplateFields(formData);

  if (Object.keys(parsed.fieldErrors).length > 0 || !parsed.category) {
    return {
      status: "error",
      message: "Review the template details.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  const organizationId = await resolveOrganizationId(actor.actor.userId);

  if (!organizationId) {
    return { status: "error", message: "Organization not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const created = await prisma.$transaction(async (transaction) => {
      const template = await transaction.correspondenceTemplate.create({
        data: {
          organizationId,
          name: parsed.name,
          category: parsed.category!,
          defaultTitle: parsed.defaultTitle,
          body: parsed.body,
          employeeVisible: parsed.employeeVisible,
          requiresAcknowledgement: parsed.requiresAcknowledgement,
          allowsEmployeeResponse: parsed.allowsEmployeeResponse,
        },
        select: { id: true },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "CREATE",
          entityType: "CorrespondenceTemplate",
          entityId: template.id,
          description: `Created correspondence template “${parsed.name}”`,
          newValues: {
            name: parsed.name,
            category: parsed.category,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });

      return template;
    });

    revalidatePath("/people/documents/templates");
    redirect(`/people/documents/templates/${created.id}/edit`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save the template.";
    return { status: "error", message };
  }
}

export async function updateCorrespondenceTemplate(
  _previousState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const templateId = textValue(formData, "templateId");
  const parsed = parseTemplateFields(formData);

  if (Object.keys(parsed.fieldErrors).length > 0 || !parsed.category) {
    return {
      status: "error",
      message: "Review the template details.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  const organizationId = await resolveOrganizationId(actor.actor.userId);

  const existing = await prisma.correspondenceTemplate.findFirst({
    where: {
      id: templateId,
      ...(organizationId ? { organizationId } : {}),
    },
    select: { id: true, name: true, category: true },
  });

  if (!existing) {
    return { status: "error", message: "The template no longer exists." };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const isActive = checkboxValue(formData, "isActive");

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.correspondenceTemplate.update({
        where: { id: existing.id },
        data: {
          name: parsed.name,
          category: parsed.category!,
          defaultTitle: parsed.defaultTitle,
          body: parsed.body,
          employeeVisible: parsed.employeeVisible,
          requiresAcknowledgement: parsed.requiresAcknowledgement,
          allowsEmployeeResponse: parsed.allowsEmployeeResponse,
          isActive,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "CorrespondenceTemplate",
          entityId: existing.id,
          description: `Updated correspondence template “${parsed.name}”`,
          oldValues: {
            name: existing.name,
            category: existing.category,
          },
          newValues: {
            name: parsed.name,
            category: parsed.category,
            isActive,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    revalidatePath("/people/documents/templates");
    revalidatePath(`/people/documents/templates/${existing.id}/edit`);
    redirect(`/people/documents/templates/${existing.id}/edit`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update the template.";
    return { status: "error", message };
  }
}
