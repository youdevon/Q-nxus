"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

export type StatutoryRateFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

const RATE_TYPES = ["PAYE"] as const;

type RateType = (typeof RATE_TYPES)[number];

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateRate(formData: FormData) {
  const fieldErrors: Record<string, string> = {};

  const rateTypeRaw = textValue(formData, "rateType");
  const rateType = RATE_TYPES.includes(rateTypeRaw as RateType)
    ? (rateTypeRaw as RateType)
    : null;

  if (!rateType) {
    fieldErrors.rateType = "Select a valid rate type.";
  }

  const ratePercentRaw = textValue(formData, "ratePercent");
  const ratePercent = Number(ratePercentRaw);

  if (
    !ratePercentRaw ||
    !Number.isFinite(ratePercent) ||
    ratePercent < 0 ||
    ratePercent > 100
  ) {
    fieldErrors.ratePercent = "Enter a rate between 0 and 100.";
  }

  const effectiveFrom = parseDate(textValue(formData, "effectiveFrom"));

  if (!effectiveFrom) {
    fieldErrors.effectiveFrom = "Enter a valid effective-from date.";
  }

  const effectiveToRaw = nullableText(formData, "effectiveTo");
  const effectiveTo = effectiveToRaw ? parseDate(effectiveToRaw) : null;

  if (effectiveToRaw && !effectiveTo) {
    fieldErrors.effectiveTo = "Enter a valid effective-to date.";
  }

  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
    fieldErrors.effectiveTo =
      "Effective-to date must be on or after the effective-from date.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    values: {
      rateType,
      ratePercent,
      effectiveFrom,
      effectiveTo,
      notes: nullableText(formData, "notes"),
      isActive: formData.get("isActive") === "on",
    },
  };
}

export async function createStatutoryRate(
  _previousState: StatutoryRateFormState,
  formData: FormData,
): Promise<StatutoryRateFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const validation = validateRate(formData);

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the statutory rate information.",
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

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const created = await prisma.statutoryRate.create({
      data: {
        organizationId: organization.id,
        rateType: validation.values.rateType!,
        ratePercent: new Prisma.Decimal(
          validation.values.ratePercent.toFixed(4),
        ),
        effectiveFrom: validation.values.effectiveFrom!,
        effectiveTo: validation.values.effectiveTo,
        notes: validation.values.notes,
        isActive: validation.values.isActive,
      },
      select: {
        id: true,
        rateType: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "payroll",
        action: "CREATE",
        entityType: "StatutoryRate",
        entityId: created.id,
        description: `Created ${created.rateType} statutory rate of ${validation.values.ratePercent}%.`,
        newValues: {
          rateType: validation.values.rateType,
          ratePercent: validation.values.ratePercent,
          effectiveFrom: textValue(formData, "effectiveFrom"),
          effectiveTo: nullableText(formData, "effectiveTo"),
          isActive: validation.values.isActive,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("Unable to create statutory rate:", error);

    return {
      status: "error",
      message: "Unable to create the statutory rate. Try again.",
    };
  }

  revalidatePath("/payroll/settings");
  redirect("/payroll/settings");
}

export async function updateStatutoryRate(
  _previousState: StatutoryRateFormState,
  formData: FormData,
): Promise<StatutoryRateFormState> {
  const actor = await requireActor("payroll.manage");

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
      message: "Missing statutory rate reference.",
    };
  }

  const validation = validateRate(formData);

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the statutory rate information.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const existing = await prisma.statutoryRate.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      rateType: true,
      ratePercent: true,
      effectiveFrom: true,
      effectiveTo: true,
      isActive: true,
    },
  });

  if (!existing) {
    return {
      status: "error",
      message: "Statutory rate not found.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.statutoryRate.update({
      where: {
        id,
      },
      data: {
        rateType: validation.values.rateType!,
        ratePercent: new Prisma.Decimal(
          validation.values.ratePercent.toFixed(4),
        ),
        effectiveFrom: validation.values.effectiveFrom!,
        effectiveTo: validation.values.effectiveTo,
        notes: validation.values.notes,
        isActive: validation.values.isActive,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "StatutoryRate",
        entityId: id,
        description: `Updated ${validation.values.rateType} statutory rate to ${validation.values.ratePercent}%.`,
        oldValues: {
          rateType: existing.rateType,
          ratePercent: existing.ratePercent.toString(),
          effectiveFrom: existing.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo:
            existing.effectiveTo?.toISOString().slice(0, 10) ?? null,
          isActive: existing.isActive,
        },
        newValues: {
          rateType: validation.values.rateType,
          ratePercent: validation.values.ratePercent,
          effectiveFrom: textValue(formData, "effectiveFrom"),
          effectiveTo: nullableText(formData, "effectiveTo"),
          isActive: validation.values.isActive,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("Unable to update statutory rate:", error);

    return {
      status: "error",
      message: "Unable to update the statutory rate. Try again.",
    };
  }

  revalidatePath("/payroll/settings");
  redirect("/payroll/settings");
}
