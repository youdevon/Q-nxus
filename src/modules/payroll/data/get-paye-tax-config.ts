import { prisma } from "@/lib/prisma";
import {
  type PayeTaxConfigRecord,
  toPayeConfigInput,
} from "@/src/modules/payroll/lib/paye-contribution";
import {
  statutoryScheduleCoversAsOf,
  toStatutoryAsOfDate,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type {
  PayeTaxBracketRecord,
  PayeTaxConfigRecord,
} from "@/src/modules/payroll/lib/paye-contribution";
export { toPayeConfigInput };

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapPayeConfig(
  config: {
    id: string;
    countryCode: string;
    taxYear: number | null;
    currencyCode: string;
    personalAllowanceAnnual: { toString(): string };
    nisDeductiblePortion: { toString(): string };
    approvedDeductionCapAnnual: { toString(): string };
    effectiveFrom: Date;
    effectiveTo: Date | null;
    versionLabel: string | null;
    sourceReference: string | null;
    approvedByUserId: string | null;
    approvedAt: Date | null;
    isActive: boolean;
    brackets: Array<{
      id: string;
      upToAmount: { toString(): string } | null;
      ratePercent: { toString(): string };
      sortOrder: number;
    }>;
  },
  isCurrent: boolean,
): PayeTaxConfigRecord {
  const effectiveFrom = toDateString(config.effectiveFrom);
  return {
    id: config.id,
    countryCode: config.countryCode,
    taxYear: config.taxYear ?? Number(effectiveFrom.slice(0, 4)),
    currencyCode: config.currencyCode,
    personalAllowanceAnnual: config.personalAllowanceAnnual.toString(),
    nisDeductiblePortion: config.nisDeductiblePortion.toString(),
    approvedDeductionCapAnnual: config.approvedDeductionCapAnnual.toString(),
    effectiveFrom,
    effectiveTo: config.effectiveTo ? toDateString(config.effectiveTo) : null,
    versionLabel: config.versionLabel,
    sourceReference: config.sourceReference,
    approvedByUserId: config.approvedByUserId,
    approvedAt: config.approvedAt?.toISOString() ?? null,
    isActive: config.isActive,
    isCurrent,
    brackets: config.brackets.map((bracket) => ({
      id: bracket.id,
      upToAmount: bracket.upToAmount?.toString() ?? null,
      ratePercent: bracket.ratePercent.toString(),
      sortOrder: bracket.sortOrder,
    })),
  };
}

const payeInclude = {
  brackets: {
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

/** All PAYE schedules for Settings UI (`isCurrent` = covers today). */
export async function getPayeTaxConfigs(): Promise<PayeTaxConfigRecord[]> {
  const configs = await prisma.payeTaxConfig.findMany({
    orderBy: { effectiveFrom: "desc" },
    include: payeInclude,
  });

  const today = toStatutoryAsOfKey(new Date());
  let currentAssigned = false;

  return configs.map((config) => {
    const effectiveFrom = toDateString(config.effectiveFrom);
    const effectiveTo = config.effectiveTo
      ? toDateString(config.effectiveTo)
      : null;
    const isCurrent =
      statutoryScheduleCoversAsOf({
        effectiveFrom,
        effectiveTo,
        isActive: config.isActive,
        asOf: today,
      }) && !currentAssigned;

    if (isCurrent) {
      currentAssigned = true;
    }

    return mapPayeConfig(config, isCurrent);
  });
}

/**
 * PAYE schedule covering `asOf` (pay period end / calculation date).
 * Prefers the latest `effectiveFrom` among active covering rows.
 */
export async function getPayeTaxConfigAsOf(
  asOf: Date | string,
): Promise<PayeTaxConfigRecord | null> {
  const asOfKey = toStatutoryAsOfKey(asOf);
  const asOfDate = toStatutoryAsOfDate(asOfKey);

  const config = await prisma.payeTaxConfig.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
    include: payeInclude,
  });

  if (!config) {
    return null;
  }

  return mapPayeConfig(config, true);
}

/** @deprecated Prefer {@link getPayeTaxConfigAsOf} with an explicit period date. */
export async function getCurrentPayeTaxConfig(): Promise<PayeTaxConfigRecord | null> {
  return getPayeTaxConfigAsOf(new Date());
}

export async function getPayeTaxConfig(
  id: string,
): Promise<PayeTaxConfigRecord | null> {
  const config = await prisma.payeTaxConfig.findUnique({
    where: { id },
    include: payeInclude,
  });

  if (!config) {
    return null;
  }

  const today = toStatutoryAsOfKey(new Date());
  const effectiveFrom = toDateString(config.effectiveFrom);
  const effectiveTo = config.effectiveTo
    ? toDateString(config.effectiveTo)
    : null;
  const isCurrent = statutoryScheduleCoversAsOf({
    effectiveFrom,
    effectiveTo,
    isActive: config.isActive,
    asOf: today,
  });

  return mapPayeConfig(config, isCurrent);
}
