"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

export type OrganizationHolidayFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createOrganizationHoliday(
  _previousState: OrganizationHolidayFormState,
  formData: FormData,
): Promise<OrganizationHolidayFormState> {
  const actor = await requireActor("leave.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const name = textValue(formData, "name");
  const holidayDate = parseDate(textValue(formData, "holidayDate"));
  const isRecurring = formData.get("isRecurring") === "on";
  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) {
    fieldErrors.name = "Name must contain at least two characters.";
  }

  if (!holidayDate) {
    fieldErrors.holidayDate = "Enter a valid holiday date.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the holiday details.",
      fieldErrors,
    };
  }

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!organization) {
    return {
      status: "error",
      message: "No organization is configured.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const created = await prisma.organizationHoliday.create({
      data: {
        organizationId: organization.id,
        name,
        holidayDate: holidayDate!,
        isRecurring,
        isActive: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "CREATE",
        entityType: "OrganizationHoliday",
        entityId: created.id,
        description: `Added organization holiday ${name}.`,
        newValues: {
          name,
          holidayDate: holidayDate!.toISOString().slice(0, 10),
          isRecurring,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath("/people/leave/holidays");
    revalidatePath("/leave/new");

    return {
      status: "success",
      message: "Holiday added.",
    };
  } catch (error) {
    console.error("Unable to create organization holiday:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The holiday could not be added.",
    };
  }
}

export async function deactivateOrganizationHoliday(
  _previousState: OrganizationHolidayFormState,
  formData: FormData,
): Promise<OrganizationHolidayFormState> {
  const actor = await requireActor("leave.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const id = textValue(formData, "id");

  if (!id) {
    return {
      status: "error",
      message: "The holiday could not be found.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.organizationHoliday.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "UPDATE",
        entityType: "OrganizationHoliday",
        entityId: id,
        description: "Deactivated organization holiday.",
        newValues: { isActive: false },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath("/people/leave/holidays");
    revalidatePath("/leave/new");

    return {
      status: "success",
      message: "Holiday deactivated.",
    };
  } catch (error) {
    console.error("Unable to deactivate organization holiday:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The holiday could not be deactivated.",
    };
  }
}
