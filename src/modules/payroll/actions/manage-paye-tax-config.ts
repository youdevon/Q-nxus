"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";

export type PayeTaxFormState = {
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
  options?: { max?: number },
): number | null {
  const amount = Number(value);

  if (!value || !Number.isFinite(amount) || amount < 0) {
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }

  if (options?.max != null && amount > options.max) {
    fieldErrors[field] = `Must be at most ${options.max}.`;
    return null;
  }

  return amount;
}

type BracketRow = {
  upToAmount: number | null;
  ratePercent: number;
  sortOrder: number;
};

function parseBracketsJson(raw: string): {
  valid: boolean;
  fieldErrors: Record<string, string>;
  brackets: BracketRow[];
} {
  const fieldErrors: Record<string, string> = {};

  if (!raw) {
    return {
      valid: false,
      fieldErrors: { brackets: "Tax brackets are required." },
      brackets: [],
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      valid: false,
      fieldErrors: { brackets: "Tax bracket data is invalid." },
      brackets: [],
    };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      valid: false,
      fieldErrors: { brackets: "Add at least one tax bracket." },
      brackets: [],
    };
  }

  const brackets: BracketRow[] = [];

  for (const [index, row] of parsed.entries()) {
    if (typeof row !== "object" || row == null) {
      fieldErrors[`brackets.${index}`] = "Invalid bracket row.";
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
        : parsePositiveNumber(upToRaw, `brackets.${index}.upToAmount`, fieldErrors);
    const ratePercent = parsePositiveNumber(
      String(record.ratePercent ?? ""),
      `brackets.${index}.ratePercent`,
      fieldErrors,
      { max: 100 },
    );

    if (ratePercent != null) {
      brackets.push({
        upToAmount,
        ratePercent,
        sortOrder: index,
      });
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    brackets,
  };
}

function revalidatePayePaths() {
  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/paye");
}

export async function savePayeTaxConfig(
  _previousState: PayeTaxFormState,
  formData: FormData,
): Promise<PayeTaxFormState> {
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

  const personalAllowanceAnnual = parsePositiveNumber(
    textValue(formData, "personalAllowanceAnnual"),
    "personalAllowanceAnnual",
    fieldErrors,
  );
  const nisDeductiblePortion = parsePositiveNumber(
    textValue(formData, "nisDeductiblePortion"),
    "nisDeductiblePortion",
    fieldErrors,
    { max: 1 },
  );
  const approvedDeductionCapAnnual = parsePositiveNumber(
    textValue(formData, "approvedDeductionCapAnnual"),
    "approvedDeductionCapAnnual",
    fieldErrors,
  );

  const bracketsParsed = parseBracketsJson(textValue(formData, "bracketsJson"));
  Object.assign(fieldErrors, bracketsParsed.fieldErrors);

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

  if (!bracketsParsed.valid || Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the PAYE configuration.",
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
        const source = await tx.payeTaxConfig.findUnique({
          where: { id: sourceId },
          select: { id: true, effectiveFrom: true },
        });

        if (source) {
          const closeDate = new Date(effectiveFrom!);
          closeDate.setUTCDate(closeDate.getUTCDate() - 1);

          await tx.payeTaxConfig.updateMany({
            where: {
              organizationId: organization.id,
              id: source.id,
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: closeDate } }],
            },
            data: { effectiveTo: closeDate },
          });
        }
      }

      if (id) {
        await tx.payeTaxBracket.deleteMany({ where: { payeTaxConfigId: id } });
        await tx.payeTaxConfig.update({
          where: { id },
          data: {
            personalAllowanceAnnual: new Prisma.Decimal(
              personalAllowanceAnnual!.toFixed(2),
            ),
            nisDeductiblePortion: new Prisma.Decimal(
              nisDeductiblePortion!.toFixed(4),
            ),
            approvedDeductionCapAnnual: new Prisma.Decimal(
              approvedDeductionCapAnnual!.toFixed(2),
            ),
            effectiveFrom: effectiveFrom!,
            effectiveTo,
            versionLabel,
            isActive,
            brackets: {
              create: bracketsParsed.brackets.map((bracket) => ({
                upToAmount:
                  bracket.upToAmount == null
                    ? null
                    : new Prisma.Decimal(bracket.upToAmount.toFixed(2)),
                ratePercent: new Prisma.Decimal(bracket.ratePercent.toFixed(4)),
                sortOrder: bracket.sortOrder,
              })),
            },
          },
        });
        return id;
      }

      const created = await tx.payeTaxConfig.create({
        data: {
          organizationId: organization.id,
          personalAllowanceAnnual: new Prisma.Decimal(
            personalAllowanceAnnual!.toFixed(2),
          ),
          nisDeductiblePortion: new Prisma.Decimal(
            nisDeductiblePortion!.toFixed(4),
          ),
          approvedDeductionCapAnnual: new Prisma.Decimal(
            approvedDeductionCapAnnual!.toFixed(2),
          ),
          effectiveFrom: effectiveFrom!,
          effectiveTo,
          versionLabel,
          isActive,
          brackets: {
            create: bracketsParsed.brackets.map((bracket) => ({
              upToAmount:
                bracket.upToAmount == null
                  ? null
                  : new Prisma.Decimal(bracket.upToAmount.toFixed(2)),
              ratePercent: new Prisma.Decimal(bracket.ratePercent.toFixed(4)),
              sortOrder: bracket.sortOrder,
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
        entityType: "PayeTaxConfig",
        entityId: savedId,
        description: `Saved PAYE tax config effective ${effectiveFromKey}.`,
        newValues: {
          effectiveFrom: effectiveFromKey,
          personalAllowanceAnnual,
          nisDeductiblePortion,
          approvedDeductionCapAnnual,
          bracketCount: bracketsParsed.brackets.length,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  } catch (error) {
    console.error("Unable to save PAYE config:", error);

    return {
      status: "error",
      message: "Unable to save the PAYE configuration. Try again.",
    };
  }

  revalidatePayePaths();
  redirect("/payroll/settings/paye");
}
