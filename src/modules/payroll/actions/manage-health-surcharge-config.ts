"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

export type HealthSurchargeFormState = {
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

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePositiveNumber(
  value: string,
  field: string,
  fieldErrors: Record<string, string>,
): number | null {
  const amount = Number(value);

  if (!value || !Number.isFinite(amount) || amount < 0) {
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }

  return amount;
}

function parseIntField(
  value: string,
  field: string,
  fieldErrors: Record<string, string>,
): number | null {
  const amount = Number(value);

  if (!value || !Number.isInteger(amount) || amount < 0) {
    fieldErrors[field] = "Enter a whole number age.";
    return null;
  }

  return amount;
}

function revalidateHealthPaths() {
  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/health");
}

export async function saveHealthSurchargeConfig(
  _previousState: HealthSurchargeFormState,
  formData: FormData,
): Promise<HealthSurchargeFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const id = nullableText(formData, "id");
  const sourceId = nullableText(formData, "sourceId");
  const fieldErrors: Record<string, string> = {};

  const effectiveFrom = parseDate(textValue(formData, "effectiveFrom"));
  const effectiveToRaw = nullableText(formData, "effectiveTo");
  const effectiveTo = effectiveToRaw ? parseDate(effectiveToRaw) : null;
  const versionLabel = nullableText(formData, "versionLabel");
  const isActive = formData.get("isActive") === "on";

  const higherWeeklyAmount = parsePositiveNumber(
    textValue(formData, "higherWeeklyAmount"),
    "higherWeeklyAmount",
    fieldErrors,
  );
  const lowerWeeklyAmount = parsePositiveNumber(
    textValue(formData, "lowerWeeklyAmount"),
    "lowerWeeklyAmount",
    fieldErrors,
  );
  const weeklyEarningsThreshold = parsePositiveNumber(
    textValue(formData, "weeklyEarningsThreshold"),
    "weeklyEarningsThreshold",
    fieldErrors,
  );
  const monthlyEarningsThreshold = parsePositiveNumber(
    textValue(formData, "monthlyEarningsThreshold"),
    "monthlyEarningsThreshold",
    fieldErrors,
  );
  const underAgeExempt = parseIntField(
    textValue(formData, "underAgeExempt"),
    "underAgeExempt",
    fieldErrors,
  );
  const seniorAgeExempt = parseIntField(
    textValue(formData, "seniorAgeExempt"),
    "seniorAgeExempt",
    fieldErrors,
  );

  if (!effectiveFrom) {
    fieldErrors.effectiveFrom = "Enter a valid effective-from date.";
  }

  if (effectiveToRaw && !effectiveTo) {
    fieldErrors.effectiveTo = "Enter a valid effective-to date.";
  }

  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
    fieldErrors.effectiveTo =
      "Effective-to date must be on or after the effective-from date.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the Health Surcharge configuration.",
      fieldErrors,
    };
  }

  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!organization) {
    return { status: "error", message: "No organization is configured." };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const effectiveFromKey = effectiveFrom!.toISOString().slice(0, 10);

  try {
    const savedId = await prisma.$transaction(async (tx) => {
      if (sourceId && !id) {
        const closeDate = new Date(effectiveFrom!);
        closeDate.setUTCDate(closeDate.getUTCDate() - 1);

        await tx.healthSurchargeConfig.updateMany({
          where: {
            organizationId: organization.id,
            id: sourceId,
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: closeDate } }],
          },
          data: { effectiveTo: closeDate },
        });
      }

      const data = {
        higherWeeklyAmount: new Prisma.Decimal(higherWeeklyAmount!.toFixed(2)),
        lowerWeeklyAmount: new Prisma.Decimal(lowerWeeklyAmount!.toFixed(2)),
        weeklyEarningsThreshold: new Prisma.Decimal(
          weeklyEarningsThreshold!.toFixed(2),
        ),
        monthlyEarningsThreshold: new Prisma.Decimal(
          monthlyEarningsThreshold!.toFixed(2),
        ),
        underAgeExempt: underAgeExempt!,
        seniorAgeExempt: seniorAgeExempt!,
        effectiveFrom: effectiveFrom!,
        effectiveTo,
        versionLabel,
        isActive,
      };

      if (id) {
        await tx.healthSurchargeConfig.update({ where: { id }, data });
        return id;
      }

      const created = await tx.healthSurchargeConfig.create({
        data: {
          organizationId: organization.id,
          ...data,
        },
        select: { id: true },
      });

      return created.id;
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "payroll",
        action: id ? "UPDATE" : "CREATE",
        entityType: "HealthSurchargeConfig",
        entityId: savedId,
        description: `Saved Health Surcharge config effective ${effectiveFromKey}.`,
        newValues: {
          effectiveFrom: effectiveFromKey,
          higherWeeklyAmount,
          lowerWeeklyAmount,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("Unable to save Health Surcharge config:", error);

    return {
      status: "error",
      message: "Unable to save the Health Surcharge configuration. Try again.",
    };
  }

  revalidateHealthPaths();
  redirect("/payroll/settings/health");
}
