"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getNisClassesForVersion } from "@/src/modules/payroll/data/get-nis-classes";
import {
  TT_NIS_2026_CLASSES,
  TT_NIS_2026_EFFECTIVE_FROM,
} from "@/src/modules/payroll/lib/nis-seed-data";
import {
  recalculateAfterTaxChange,
  taxYearForEffectiveFrom,
} from "@/src/modules/payroll/services/recalculate-after-tax-change";

export type NisClassFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

type ParsedClassRow = {
  classCode: string;
  monthlyMin: number;
  monthlyMax: number | null;
  employeeWeeklyAmount: number;
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

function parseMoney(value: string, field: string, fieldErrors: Record<string, string>) {
  const amount = Number(value);

  if (!value || !Number.isFinite(amount) || amount < 0) {
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }

  return amount;
}

function parseClassesJson(raw: string): {
  valid: boolean;
  fieldErrors: Record<string, string>;
  classes: ParsedClassRow[];
} {
  const fieldErrors: Record<string, string> = {};

  if (!raw) {
    return {
      valid: false,
      fieldErrors: { classes: "Class table data is missing." },
      classes: [],
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      valid: false,
      fieldErrors: { classes: "Class table data is invalid." },
      classes: [],
    };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      valid: false,
      fieldErrors: { classes: "Add at least one earnings class." },
      classes: [],
    };
  }

  const classes: ParsedClassRow[] = [];

  for (const [index, row] of parsed.entries()) {
    if (typeof row !== "object" || row == null) {
      fieldErrors[`classes.${index}`] = "Invalid class row.";
      continue;
    }

    const record = row as Record<string, unknown>;
    const classCode =
      typeof record.classCode === "string" ? record.classCode.trim() : "";

    if (!classCode) {
      fieldErrors[`classes.${index}.classCode`] = "Class code is required.";
    }

    const monthlyMin = parseMoney(
      String(record.monthlyMin ?? ""),
      `classes.${index}.monthlyMin`,
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
            `classes.${index}.monthlyMax`,
            fieldErrors,
          );
    const employeeWeeklyAmount = parseMoney(
      String(record.employeeWeeklyAmount ?? ""),
      `classes.${index}.employeeWeeklyAmount`,
      fieldErrors,
    );
    const employerWeeklyAmount = parseMoney(
      String(record.employerWeeklyAmount ?? ""),
      `classes.${index}.employerWeeklyAmount`,
      fieldErrors,
    );

    if (
      monthlyMin != null &&
      monthlyMax != null &&
      monthlyMax < monthlyMin
    ) {
      fieldErrors[`classes.${index}.monthlyMax`] =
        "Maximum must be on or after the minimum.";
    }

    if (
      classCode &&
      monthlyMin != null &&
      employeeWeeklyAmount != null &&
      employerWeeklyAmount != null
    ) {
      classes.push({
        classCode,
        monthlyMin,
        monthlyMax,
        employeeWeeklyAmount,
        employerWeeklyAmount,
      });
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    classes,
  };
}

async function getOrganizationId(): Promise<string | null> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  return organization?.id ?? null;
}

function revalidateNisPaths() {
  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/nis");
}

export async function saveNisClassVersion(
  _previousState: NisClassFormState,
  formData: FormData,
): Promise<NisClassFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const sourceEffectiveFrom = nullableText(formData, "sourceEffectiveFrom");
  const effectiveFrom = parseDate(textValue(formData, "effectiveFrom"));
  const effectiveToRaw = nullableText(formData, "effectiveTo");
  const effectiveTo = effectiveToRaw ? parseDate(effectiveToRaw) : null;
  const versionLabel = nullableText(formData, "versionLabel");
  const isActive = formData.get("isActive") === "on";
  const classesJson = textValue(formData, "classesJson");
  const parsedClasses = parseClassesJson(classesJson);

  const fieldErrors: Record<string, string> = {
    ...parsedClasses.fieldErrors,
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

  if (!parsedClasses.valid) {
    return {
      status: "error",
      message: "Review the NIS class table.",
      fieldErrors,
    };
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the NIS class table.",
      fieldErrors,
    };
  }

  const organizationId = await getOrganizationId();

  if (!organizationId) {
    return {
      status: "error",
      message: "No organization is configured.",
    };
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

          await tx.nisEarningsClass.updateMany({
            where: {
              organizationId,
              effectiveFrom: previousFrom,
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: closeDate } }],
            },
            data: {
              effectiveTo: closeDate,
            },
          });
        }
      }

      await tx.nisEarningsClass.deleteMany({
        where: {
          organizationId,
          effectiveFrom: effectiveFrom!,
        },
      });

      await tx.nisEarningsClass.createMany({
        data: parsedClasses.classes.map((row) => ({
          organizationId,
          classCode: row.classCode,
          monthlyMin: new Prisma.Decimal(row.monthlyMin.toFixed(2)),
          monthlyMax:
            row.monthlyMax == null
              ? null
              : new Prisma.Decimal(row.monthlyMax.toFixed(2)),
          employeeWeeklyAmount: new Prisma.Decimal(
            row.employeeWeeklyAmount.toFixed(2),
          ),
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
        entityType: "NisEarningsClass",
        entityId: effectiveFromKey,
        description: `Saved NIS earnings-class schedule effective ${effectiveFromKey} (${parsedClasses.classes.length} classes).`,
        newValues: {
          effectiveFrom: effectiveFromKey,
          effectiveTo: effectiveToRaw,
          versionLabel,
          isActive,
          classCount: parsedClasses.classes.length,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("Unable to save NIS class version:", error);

    return {
      status: "error",
      message: "Unable to save the NIS class schedule. Try again.",
    };
  }

  revalidateNisPaths();
  await recalculateAfterTaxChange({
    organizationId,
    taxYear: taxYearForEffectiveFrom(effectiveFrom!),
    actorUserId: actor.actor.userId,
    reason: `NIS class schedule effective ${effectiveFromKey}`,
    effectiveFrom: effectiveFrom!,
    metadata,
  });
  redirect(`/payroll/settings/nis?version=${effectiveFromKey}`);
}

export async function seedDefaultNisClasses(): Promise<{
  ok: boolean;
  message: string;
}> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return {
      ok: false,
      message: actor.message,
    };
  }

  const organizationId = await getOrganizationId();

  if (!organizationId) {
    return {
      ok: false,
      message: "No organization is configured.",
    };
  }

  const existing = await getNisClassesForVersion(TT_NIS_2026_EFFECTIVE_FROM);

  if (existing.length > 0) {
    return {
      ok: true,
      message: "2026 NIS classes are already configured.",
    };
  }

  try {
    await prisma.nisEarningsClass.createMany({
      data: TT_NIS_2026_CLASSES.map((row) => ({
        organizationId,
        classCode: row.classCode,
        monthlyMin: new Prisma.Decimal(row.monthlyMin.toFixed(2)),
        monthlyMax:
          row.monthlyMax == null
            ? null
            : new Prisma.Decimal(row.monthlyMax.toFixed(2)),
        employeeWeeklyAmount: new Prisma.Decimal(
          row.employeeWeeklyAmount.toFixed(2),
        ),
        employerWeeklyAmount: new Prisma.Decimal(
          row.employerWeeklyAmount.toFixed(2),
        ),
        effectiveFrom: new Date(`${TT_NIS_2026_EFFECTIVE_FROM}T00:00:00.000Z`),
        versionLabel: "2026",
        isActive: true,
      })),
    });
  } catch (error) {
    console.error("Unable to seed NIS classes:", error);

    return {
      ok: false,
      message: "Unable to seed default NIS classes.",
    };
  }

  revalidateNisPaths();

  return {
    ok: true,
    message: "Loaded default 2026 NIS earnings classes.",
  };
}
