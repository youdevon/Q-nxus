"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getNisClassZRatesForVersion } from "@/src/modules/payroll/data/get-nis-class-z-rates";
import {
  TT_NIS_CLASS_Z_2026_EFFECTIVE_FROM,
  TT_NIS_CLASS_Z_2026_RATES,
} from "@/src/modules/payroll/lib/nis-class-z-seed-data";
import { validateNisClassZRateSchedule } from "@/src/modules/payroll/lib/nis-class-z";
import {
  recalculateAfterTaxChange,
  taxYearForEffectiveFrom,
} from "@/src/modules/payroll/services/recalculate-after-tax-change";

export type NisClassZFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

export type NisEligibilityFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

type ParsedBandRow = {
  monthlyMin: number;
  monthlyMax: number | null;
  employerWeeklyAmount: number;
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

function parseMoney(
  value: string,
  field: string,
  fieldErrors: Record<string, string>,
) {
  const amount = Number(value);

  if (!value || !Number.isFinite(amount) || amount < 0) {
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }

  return amount;
}

function parseBandsJson(raw: string): {
  valid: boolean;
  fieldErrors: Record<string, string>;
  bands: ParsedBandRow[];
} {
  const fieldErrors: Record<string, string> = {};

  if (!raw) {
    return {
      valid: false,
      fieldErrors: { bands: "Rate table data is missing." },
      bands: [],
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      valid: false,
      fieldErrors: { bands: "Rate table data is invalid." },
      bands: [],
    };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      valid: false,
      fieldErrors: { bands: "Add at least one earnings band." },
      bands: [],
    };
  }

  const bands: ParsedBandRow[] = [];

  for (const [index, row] of parsed.entries()) {
    if (typeof row !== "object" || row == null) {
      fieldErrors[`bands.${index}`] = "Invalid band row.";
      continue;
    }

    const record = row as Record<string, unknown>;
    const monthlyMin = parseMoney(
      String(record.monthlyMin ?? ""),
      `bands.${index}.monthlyMin`,
      fieldErrors,
    );
    const monthlyMaxRaw =
      record.monthlyMax == null || record.monthlyMax === ""
        ? null
        : String(record.monthlyMax);
    const monthlyMax =
      monthlyMaxRaw == null
        ? null
        : parseMoney(
            monthlyMaxRaw,
            `bands.${index}.monthlyMax`,
            fieldErrors,
          );
    const employerWeeklyAmount = parseMoney(
      String(record.employerWeeklyAmount ?? ""),
      `bands.${index}.employerWeeklyAmount`,
      fieldErrors,
    );

    if (
      monthlyMin != null &&
      monthlyMax != null &&
      monthlyMax < monthlyMin
    ) {
      fieldErrors[`bands.${index}.monthlyMax`] =
        "Maximum must be on or after the minimum.";
    }

    if (
      monthlyMin != null &&
      employerWeeklyAmount != null
    ) {
      bands.push({
        monthlyMin,
        monthlyMax,
        employerWeeklyAmount,
      });
    }
  }

  const scheduleErrors = validateNisClassZRateSchedule(bands);
  for (const [index, message] of scheduleErrors.entries()) {
    fieldErrors[`bands.schedule.${index}`] = message;
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    bands,
  };
}

async function getOrganizationId(): Promise<string | null> {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return organization?.id ?? null;
}

function revalidateClassZPaths() {
  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/nis");
  revalidatePath("/payroll/settings/nis/class-z");
}

export async function saveNisClassZRateVersion(
  _previousState: NisClassZFormState,
  formData: FormData,
): Promise<NisClassZFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const sourceEffectiveFrom = nullableText(formData, "sourceEffectiveFrom");
  const effectiveFrom = parseDate(textValue(formData, "effectiveFrom"));
  const effectiveToRaw = nullableText(formData, "effectiveTo");
  const effectiveTo = effectiveToRaw ? parseDate(effectiveToRaw) : null;
  const versionLabel = nullableText(formData, "versionLabel");
  const isActive = formData.get("isActive") === "on";
  const bandsJson = textValue(formData, "bandsJson");
  const parsedBands = parseBandsJson(bandsJson);

  const fieldErrors: Record<string, string> = {
    ...parsedBands.fieldErrors,
  };

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

  if (!parsedBands.valid || Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the Class Z rate table.",
      fieldErrors,
    };
  }

  const organizationId = await getOrganizationId();

  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }

  const effectiveFromKey = effectiveFrom!.toISOString().slice(0, 10);
  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (tx) => {
      if (sourceEffectiveFrom && sourceEffectiveFrom !== effectiveFromKey) {
        const previousFrom = parseDate(sourceEffectiveFrom);

        if (previousFrom) {
          const closeDate = new Date(effectiveFrom!);
          closeDate.setUTCDate(closeDate.getUTCDate() - 1);

          await tx.nisClassZRate.updateMany({
            where: {
              organizationId,
              effectiveFrom: previousFrom,
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: closeDate } }],
            },
            data: { effectiveTo: closeDate },
          });
        }
      }

      await tx.nisClassZRate.deleteMany({
        where: {
          organizationId,
          effectiveFrom: effectiveFrom!,
        },
      });

      await tx.nisClassZRate.createMany({
        data: parsedBands.bands.map((row) => ({
          organizationId,
          monthlyMin: new Prisma.Decimal(row.monthlyMin.toFixed(2)),
          monthlyMax:
            row.monthlyMax == null
              ? null
              : new Prisma.Decimal(row.monthlyMax.toFixed(2)),
          employerWeeklyAmount: new Prisma.Decimal(
            row.employerWeeklyAmount.toFixed(2),
          ),
          effectiveFrom: effectiveFrom!,
          effectiveTo,
          versionLabel,
          isActive,
        })),
      });
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "payroll",
        action: sourceEffectiveFrom ? "UPDATE" : "CREATE",
        entityType: "NisClassZRate",
        entityId: effectiveFromKey,
        description: `Saved NIS Class Z rate schedule effective ${effectiveFromKey} (${parsedBands.bands.length} bands).`,
        newValues: {
          effectiveFrom: effectiveFromKey,
          effectiveTo: effectiveToRaw,
          versionLabel,
          isActive,
          bandCount: parsedBands.bands.length,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("Unable to save NIS Class Z rate version:", error);
    return {
      status: "error",
      message: "Unable to save the Class Z rate schedule. Try again.",
    };
  }

  revalidateClassZPaths();
  await recalculateAfterTaxChange({
    organizationId,
    taxYear: taxYearForEffectiveFrom(effectiveFrom!),
    actorUserId: actor.actor.userId,
    reason: `NIS Class Z schedule effective ${effectiveFromKey}`,
    effectiveFrom: effectiveFrom!,
    metadata,
  });
  redirect(`/payroll/settings/nis/class-z?ratesVersion=${effectiveFromKey}`);
}

export async function saveNisEligibilityConfigVersion(
  _previousState: NisEligibilityFormState,
  formData: FormData,
): Promise<NisEligibilityFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const sourceEffectiveFrom = nullableText(formData, "sourceEffectiveFrom");
  const effectiveFrom = parseDate(textValue(formData, "effectiveFrom"));
  const effectiveToRaw = nullableText(formData, "effectiveTo");
  const effectiveTo = effectiveToRaw ? parseDate(effectiveToRaw) : null;
  const versionLabel = nullableText(formData, "versionLabel");
  const notes = nullableText(formData, "notes");
  const isActive = formData.get("isActive") === "on";
  const fullRetirementAge = Number(textValue(formData, "fullRetirementAge"));
  const earlyRetirementAge = Number(textValue(formData, "earlyRetirementAge"));

  const fieldErrors: Record<string, string> = {};

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

  if (!Number.isInteger(fullRetirementAge) || fullRetirementAge < 50) {
    fieldErrors.fullRetirementAge = "Enter a valid full retirement age.";
  }

  if (!Number.isInteger(earlyRetirementAge) || earlyRetirementAge < 50) {
    fieldErrors.earlyRetirementAge = "Enter a valid early retirement age.";
  }

  if (
    Number.isInteger(fullRetirementAge) &&
    Number.isInteger(earlyRetirementAge) &&
    earlyRetirementAge >= fullRetirementAge
  ) {
    fieldErrors.earlyRetirementAge =
      "Early retirement age must be below full retirement age.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the eligibility thresholds.",
      fieldErrors,
    };
  }

  const organizationId = await getOrganizationId();

  if (!organizationId) {
    return { status: "error", message: "No organization is configured." };
  }

  const effectiveFromKey = effectiveFrom!.toISOString().slice(0, 10);
  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (tx) => {
      if (sourceEffectiveFrom && sourceEffectiveFrom !== effectiveFromKey) {
        const previousFrom = parseDate(sourceEffectiveFrom);

        if (previousFrom) {
          const closeDate = new Date(effectiveFrom!);
          closeDate.setUTCDate(closeDate.getUTCDate() - 1);

          await tx.nisEligibilityConfig.updateMany({
            where: {
              organizationId,
              effectiveFrom: previousFrom,
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: closeDate } }],
            },
            data: { effectiveTo: closeDate },
          });
        }
      }

      await tx.nisEligibilityConfig.upsert({
        where: {
          organizationId_effectiveFrom: {
            organizationId,
            effectiveFrom: effectiveFrom!,
          },
        },
        create: {
          organizationId,
          fullRetirementAge,
          earlyRetirementAge,
          effectiveFrom: effectiveFrom!,
          effectiveTo,
          versionLabel,
          notes,
          isActive,
        },
        update: {
          fullRetirementAge,
          earlyRetirementAge,
          effectiveTo,
          versionLabel,
          notes,
          isActive,
        },
      });
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "payroll",
        action: sourceEffectiveFrom ? "UPDATE" : "CREATE",
        entityType: "NisEligibilityConfig",
        entityId: effectiveFromKey,
        description: `Saved NIS Class Z eligibility thresholds effective ${effectiveFromKey}.`,
        newValues: {
          effectiveFrom: effectiveFromKey,
          fullRetirementAge,
          earlyRetirementAge,
          isActive,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("Unable to save NIS eligibility config:", error);
    return {
      status: "error",
      message: "Unable to save eligibility thresholds. Try again.",
    };
  }

  revalidateClassZPaths();
  redirect(
    `/payroll/settings/nis/class-z?eligibilityVersion=${effectiveFromKey}`,
  );
}

export async function seedDefaultNisClassZRates(): Promise<{
  ok: boolean;
  message: string;
}> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { ok: false, message: actor.message };
  }

  const organizationId = await getOrganizationId();

  if (!organizationId) {
    return { ok: false, message: "No organization is configured." };
  }

  const existing = await getNisClassZRatesForVersion(
    TT_NIS_CLASS_Z_2026_EFFECTIVE_FROM,
  );

  if (existing.length > 0) {
    return {
      ok: true,
      message: "2026 Class Z rates are already configured.",
    };
  }

  try {
    await prisma.nisClassZRate.createMany({
      data: TT_NIS_CLASS_Z_2026_RATES.map((row) => ({
        organizationId,
        monthlyMin: new Prisma.Decimal(row.monthlyMin.toFixed(2)),
        monthlyMax:
          row.monthlyMax == null
            ? null
            : new Prisma.Decimal(row.monthlyMax.toFixed(2)),
        employerWeeklyAmount: new Prisma.Decimal(
          row.employerWeeklyAmount.toFixed(2),
        ),
        effectiveFrom: new Date(`${TT_NIS_CLASS_Z_2026_EFFECTIVE_FROM}T00:00:00.000Z`),
        versionLabel: "2026",
        notes: "Default Class Z schedule effective 5 January 2026",
        isActive: true,
      })),
    });
  } catch (error) {
    console.error("Unable to seed Class Z rates:", error);
    return { ok: false, message: "Unable to seed default Class Z rates." };
  }

  revalidateClassZPaths();

  return {
    ok: true,
    message: "Loaded default 2026 Class Z employer rates.",
  };
}
