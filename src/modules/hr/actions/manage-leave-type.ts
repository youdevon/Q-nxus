"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

export type LeaveTypeFormState = {
  status: "idle" | "error";
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

function parseOptionalDecimal(value: string | null): Prisma.Decimal | null {
  if (!value) {
    return null;
  }

  try {
    const decimal = new Prisma.Decimal(value);

    if (decimal.isNeg()) {
      return null;
    }

    return decimal;
  } catch {
    return null;
  }
}

function validateLeaveType(formData: FormData) {
  const code = textValue(formData, "code").toUpperCase();
  const name = textValue(formData, "name");
  const description = nullableText(formData, "description");
  const documentRequiredAfterRaw = nullableText(
    formData,
    "documentRequiredAfter",
  );
  const maximumConsecutiveDaysRaw = nullableText(
    formData,
    "maximumConsecutiveDays",
  );
  const carryForwardLimitRaw = nullableText(formData, "carryForwardLimit");
  const minimumNoticeDays = Number.parseInt(
    textValue(formData, "minimumNoticeDays") || "0",
    10,
  );
  const sortOrder = Number.parseInt(
    textValue(formData, "sortOrder") || "0",
    10,
  );

  const fieldErrors: Record<string, string> = {};

  if (!/^[A-Z0-9_]{2,20}$/.test(code)) {
    fieldErrors.code = "Code must be 2–20 characters (A–Z, 0–9, underscore).";
  }

  if (name.length < 2) {
    fieldErrors.name = "Name must contain at least two characters.";
  }

  if (!Number.isInteger(minimumNoticeDays) || minimumNoticeDays < 0) {
    fieldErrors.minimumNoticeDays =
      "Minimum notice days must be zero or greater.";
  }

  if (!Number.isInteger(sortOrder)) {
    fieldErrors.sortOrder = "Sort order must be an integer.";
  }

  const documentRequiredAfter = parseOptionalDecimal(documentRequiredAfterRaw);
  if (documentRequiredAfterRaw && !documentRequiredAfter) {
    fieldErrors.documentRequiredAfter =
      "Enter a valid non-negative number of days.";
  }

  const maximumConsecutiveDays = parseOptionalDecimal(
    maximumConsecutiveDaysRaw,
  );
  if (maximumConsecutiveDaysRaw && !maximumConsecutiveDays) {
    fieldErrors.maximumConsecutiveDays =
      "Enter a valid non-negative number of days.";
  }

  const carryForwardLimit = parseOptionalDecimal(carryForwardLimitRaw);
  if (carryForwardLimitRaw && !carryForwardLimit) {
    fieldErrors.carryForwardLimit =
      "Enter a valid non-negative carry-forward limit.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    values: {
      code,
      name,
      description,
      isPaid: formData.get("isPaid") === "on",
      requiresBalance: formData.get("requiresBalance") === "on",
      requiresDocument: formData.get("requiresDocument") === "on",
      documentRequiredAfter,
      minimumNoticeDays,
      maximumConsecutiveDays,
      allowsHalfDay: formData.get("allowsHalfDay") === "on",
      allowsNegativeBalance: formData.get("allowsNegativeBalance") === "on",
      carryForwardAllowed: formData.get("carryForwardAllowed") === "on",
      carryForwardLimit,
      colour: nullableText(formData, "colour"),
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
      isActive: formData.get("isActive") === "on",
    },
  };
}

async function resolveOrganizationId() {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return organization?.id ?? null;
}

export async function createLeaveType(
  _previousState: LeaveTypeFormState,
  formData: FormData,
): Promise<LeaveTypeFormState> {
  const actor = await requireActor("leave.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const validation = validateLeaveType(formData);

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the leave type information.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const organizationId = await resolveOrganizationId();

  if (!organizationId) {
    return {
      status: "error",
      message: "No organization is configured.",
    };
  }

  const duplicate = await prisma.leaveType.findFirst({
    where: {
      organizationId,
      OR: [
        { code: validation.values.code },
        {
          name: {
            equals: validation.values.name,
            mode: "insensitive",
          },
        },
      ],
    },
    select: { id: true },
  });

  if (duplicate) {
    return {
      status: "error",
      message: "A leave type with this code or name already exists.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const created = await prisma.leaveType.create({
      data: {
        organizationId,
        ...validation.values,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "CREATE",
        entityType: "LeaveType",
        entityId: created.id,
        description: `Created leave type ${created.code}.`,
        newValues: validation.values,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath("/people/leave/types");
    redirect(`/people/leave/types/${created.id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to create leave type:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave type could not be created.",
    };
  }
}

export async function updateLeaveType(
  _previousState: LeaveTypeFormState,
  formData: FormData,
): Promise<LeaveTypeFormState> {
  const actor = await requireActor("leave.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const id = textValue(formData, "id");

  if (!id) {
    return {
      status: "error",
      message: "The leave type could not be found.",
    };
  }

  const existing = await prisma.leaveType.findUnique({
    where: { id },
  });

  if (!existing) {
    return {
      status: "error",
      message: "The leave type could not be found.",
    };
  }

  const validation = validateLeaveType(formData);

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the leave type information.",
      fieldErrors: validation.fieldErrors,
    };
  }

  if (existing.isSystem && validation.values.code !== existing.code) {
    return {
      status: "error",
      message: "System leave type codes cannot be changed.",
    };
  }

  const duplicate = await prisma.leaveType.findFirst({
    where: {
      organizationId: existing.organizationId,
      id: { not: id },
      OR: [
        { code: validation.values.code },
        {
          name: {
            equals: validation.values.name,
            mode: "insensitive",
          },
        },
      ],
    },
    select: { id: true },
  });

  if (duplicate) {
    return {
      status: "error",
      message: "A leave type with this code or name already exists.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.leaveType.update({
      where: { id },
      data: validation.values,
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "UPDATE",
        entityType: "LeaveType",
        entityId: id,
        description: `Updated leave type ${validation.values.code}.`,
        newValues: validation.values,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath("/people/leave/types");
    revalidatePath(`/people/leave/types/${id}`);
    redirect(`/people/leave/types/${id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Unable to update leave type:", error);

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The leave type could not be updated.",
    };
  }
}
