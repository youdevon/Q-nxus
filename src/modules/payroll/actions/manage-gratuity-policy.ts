"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import type {
  GratuityFormulaKind,
  GratuityTaxMode,
} from "@/src/modules/payroll/lib/calculate-gratuity";

export type GratuityPolicyFormState = {
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

function parseNonNegativeNumber(
  value: string,
  field: string,
  fieldErrors: Record<string, string>,
  options?: { max?: number; required?: boolean },
): number | null {
  if (!value) {
    if (options?.required) {
      fieldErrors[field] = "Enter a valid amount.";
    }
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }

  if (options?.max != null && amount > options.max) {
    fieldErrors[field] = `Must be at most ${options.max}.`;
    return null;
  }

  return amount;
}

function parseOptionalInt(
  value: string,
  field: string,
  fieldErrors: Record<string, string>,
): number | null {
  if (!value) {
    return null;
  }

  const amount = Number(value);

  if (!Number.isInteger(amount) || amount < 0) {
    fieldErrors[field] = "Enter a whole number.";
    return null;
  }

  return amount;
}

type TaxBandRow = {
  upToAmount: number | null;
  ratePercent: number;
  sortOrder: number;
};

const FORMULA_KINDS = new Set([
  "PCT_OF_TERM_EARNINGS",
  "PCT_OF_FINAL_MONTHLY_YEARS",
  "DAYS_PER_YEAR",
  "FLAT_AMOUNT",
  "MANUAL",
]);

const TAX_MODES = new Set(["NONE", "FLAT", "TIERED"]);
const PAY_TIMINGS = new Set(["LAST_CONTRACT_PAY", "OFF_CYCLE_AFTER_END"]);

function parseTaxBandsJson(raw: string): {
  valid: boolean;
  fieldErrors: Record<string, string>;
  bands: TaxBandRow[];
} {
  const fieldErrors: Record<string, string> = {};

  if (!raw) {
    return { valid: true, fieldErrors: {}, bands: [] };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      valid: false,
      fieldErrors: { taxBandsJson: "Tax band data is invalid." },
      bands: [],
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      valid: false,
      fieldErrors: { taxBandsJson: "Tax bands must be an array." },
      bands: [],
    };
  }

  const bands: TaxBandRow[] = [];

  for (const [index, row] of parsed.entries()) {
    if (typeof row !== "object" || row == null) {
      fieldErrors[`taxBands.${index}`] = "Invalid tax band row.";
      continue;
    }

    const record = row as Record<string, unknown>;
    const upToRaw =
      record.upToAmount == null || record.upToAmount === ""
        ? null
        : String(record.upToAmount);
    const upToAmount =
      upToRaw == null
        ? null
        : parseNonNegativeNumber(
            upToRaw,
            `taxBands.${index}.upToAmount`,
            fieldErrors,
          );
    const ratePercent = parseNonNegativeNumber(
      String(record.ratePercent ?? ""),
      `taxBands.${index}.ratePercent`,
      fieldErrors,
      { max: 100, required: true },
    );

    if (ratePercent != null) {
      bands.push({
        upToAmount,
        ratePercent,
        sortOrder: index,
      });
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    bands,
  };
}

function revalidateGratuityPaths() {
  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/gratuity");
  revalidatePath("/payroll/gratuity");
}

export async function saveGratuityPolicy(
  _previousState: GratuityPolicyFormState,
  formData: FormData,
): Promise<GratuityPolicyFormState> {
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
  const sourceReference = nullableText(formData, "sourceReference");
  const isActive = formData.get("isActive") === "on";
  const eligibilityOnFullTermOnly =
    formData.get("eligibilityOnFullTermOnly") === "on";
  const prorateOnEarlyExit = formData.get("prorateOnEarlyExit") === "on";

  const formulaKindRaw = textValue(formData, "formulaKind").toUpperCase();
  const taxModeRaw = textValue(formData, "taxMode").toUpperCase();
  const payTimingRaw = textValue(formData, "payTiming").toUpperCase();

  const formulaKind = FORMULA_KINDS.has(formulaKindRaw)
    ? (formulaKindRaw as GratuityFormulaKind)
    : null;
  const taxMode = TAX_MODES.has(taxModeRaw)
    ? (taxModeRaw as GratuityTaxMode)
    : null;
  const payTiming = PAY_TIMINGS.has(payTimingRaw)
    ? (payTimingRaw as "LAST_CONTRACT_PAY" | "OFF_CYCLE_AFTER_END")
    : null;

  if (!formulaKind) {
    fieldErrors.formulaKind = "Choose a valid formula.";
  }
  if (!taxMode) {
    fieldErrors.taxMode = "Choose a valid tax mode.";
  }
  if (!payTiming) {
    fieldErrors.payTiming = "Choose a valid pay timing.";
  }

  const defaultRatePercent = parseNonNegativeNumber(
    textValue(formData, "defaultRatePercent"),
    "defaultRatePercent",
    fieldErrors,
    { max: 100, required: true },
  );
  const flatTaxRatePercent = parseNonNegativeNumber(
    textValue(formData, "flatTaxRatePercent"),
    "flatTaxRatePercent",
    fieldErrors,
    { max: 100 },
  );
  const minServiceMonths = parseOptionalInt(
    textValue(formData, "minServiceMonths"),
    "minServiceMonths",
    fieldErrors,
  );
  const daysPerYearOfService = parseNonNegativeNumber(
    textValue(formData, "daysPerYearOfService"),
    "daysPerYearOfService",
    fieldErrors,
  );
  const daysInYearBasis = parseOptionalInt(
    textValue(formData, "daysInYearBasis"),
    "daysInYearBasis",
    fieldErrors,
  );

  const bandsParsed = parseTaxBandsJson(textValue(formData, "taxBandsJson"));
  Object.assign(fieldErrors, bandsParsed.fieldErrors);

  if (taxMode === "TIERED" && bandsParsed.bands.length === 0) {
    fieldErrors.taxBandsJson = "Add at least one tax band for tiered tax.";
  }

  if (taxMode === "FLAT" && flatTaxRatePercent == null) {
    fieldErrors.flatTaxRatePercent = "Enter a flat tax rate.";
  }

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
      message: "Review the gratuity policy.",
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
  const countryCode = nullableText(formData, "countryCode") ?? "TT";
  const currencyCode = nullableText(formData, "currencyCode") ?? "TTD";

  try {
    const savedId = await prisma.$transaction(async (tx) => {
      if (sourceId && !id) {
        const closeDate = new Date(effectiveFrom!);
        closeDate.setUTCDate(closeDate.getUTCDate() - 1);

        await tx.gratuityPolicy.updateMany({
          where: {
            organizationId: organization.id,
            id: sourceId,
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: closeDate } }],
          },
          data: { effectiveTo: closeDate },
        });
      }

      const data = {
        countryCode,
        currencyCode,
        formulaKind: formulaKind!,
        defaultRatePercent: new Prisma.Decimal(
          defaultRatePercent!.toFixed(4),
        ),
        taxMode: taxMode!,
        flatTaxRatePercent:
          flatTaxRatePercent != null
            ? new Prisma.Decimal(flatTaxRatePercent.toFixed(4))
            : null,
        applyPersonalAllowance: false,
        minServiceMonths,
        daysPerYearOfService:
          daysPerYearOfService != null
            ? new Prisma.Decimal(daysPerYearOfService.toFixed(4))
            : null,
        daysInYearBasis,
        eligibilityOnFullTermOnly,
        prorateOnEarlyExit,
        payTiming: payTiming!,
        effectiveFrom: effectiveFrom!,
        effectiveTo,
        versionLabel,
        sourceReference,
        isActive,
      };

      if (id) {
        await tx.gratuityTaxBand.deleteMany({ where: { gratuityPolicyId: id } });
        await tx.gratuityPolicy.update({ where: { id }, data });

        if (bandsParsed.bands.length > 0) {
          await tx.gratuityTaxBand.createMany({
            data: bandsParsed.bands.map((band) => ({
              gratuityPolicyId: id,
              upToAmount:
                band.upToAmount != null
                  ? new Prisma.Decimal(band.upToAmount.toFixed(2))
                  : null,
              ratePercent: new Prisma.Decimal(band.ratePercent.toFixed(4)),
              sortOrder: band.sortOrder,
            })),
          });
        }

        return id;
      }

      const created = await tx.gratuityPolicy.create({
        data: {
          organizationId: organization.id,
          ...data,
          taxBands: {
            create: bandsParsed.bands.map((band) => ({
              upToAmount:
                band.upToAmount != null
                  ? new Prisma.Decimal(band.upToAmount.toFixed(2))
                  : null,
              ratePercent: new Prisma.Decimal(band.ratePercent.toFixed(4)),
              sortOrder: band.sortOrder,
            })),
          },
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
        entityType: "GratuityPolicy",
        entityId: savedId,
        description: `Saved gratuity policy effective ${effectiveFromKey}.`,
        newValues: {
          effectiveFrom: effectiveFromKey,
          formulaKind,
          taxMode,
          defaultRatePercent,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("Unable to save gratuity policy:", error);

    return {
      status: "error",
      message: "Unable to save the gratuity policy. Try again.",
    };
  }

  revalidateGratuityPaths();
  redirect("/payroll/settings/gratuity");
}
