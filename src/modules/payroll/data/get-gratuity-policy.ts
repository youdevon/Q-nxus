import { prisma } from "@/lib/prisma";
import {
  type GratuityFormulaKind,
  type GratuityPolicyInput,
  type GratuityTaxMode,
  TT_DEFAULT_GRATUITY_TAX_BANDS,
} from "@/src/modules/payroll/lib/calculate-gratuity";
import {
  statutoryScheduleCoversAsOf,
  toStatutoryAsOfDate,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type GratuityTaxBandRecord = {
  id: string;
  upToAmount: string | null;
  ratePercent: string;
  sortOrder: number;
};

export type GratuityPolicyRecord = {
  id: string;
  countryCode: string;
  currencyCode: string;
  formulaKind: GratuityFormulaKind;
  defaultRatePercent: string;
  taxMode: GratuityTaxMode;
  flatTaxRatePercent: string | null;
  applyPersonalAllowance: boolean;
  minServiceMonths: number | null;
  daysPerYearOfService: string | null;
  daysInYearBasis: number | null;
  eligibilityOnFullTermOnly: boolean;
  prorateOnEarlyExit: boolean;
  payTiming: "LAST_CONTRACT_PAY" | "OFF_CYCLE_AFTER_END";
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  sourceReference: string | null;
  isActive: boolean;
  isCurrent: boolean;
  taxBands: GratuityTaxBandRecord[];
};

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapPolicy(
  config: {
    id: string;
    countryCode: string;
    currencyCode: string;
    formulaKind: string;
    defaultRatePercent: { toString(): string };
    taxMode: string;
    flatTaxRatePercent: { toString(): string } | null;
    applyPersonalAllowance: boolean;
    minServiceMonths: number | null;
    daysPerYearOfService: { toString(): string } | null;
    daysInYearBasis: number | null;
    eligibilityOnFullTermOnly: boolean;
    prorateOnEarlyExit: boolean;
    payTiming: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    versionLabel: string | null;
    sourceReference: string | null;
    isActive: boolean;
    taxBands: Array<{
      id: string;
      upToAmount: { toString(): string } | null;
      ratePercent: { toString(): string };
      sortOrder: number;
    }>;
  },
  isCurrent: boolean,
): GratuityPolicyRecord {
  return {
    id: config.id,
    countryCode: config.countryCode,
    currencyCode: config.currencyCode,
    formulaKind: config.formulaKind as GratuityFormulaKind,
    defaultRatePercent: config.defaultRatePercent.toString(),
    taxMode: config.taxMode as GratuityTaxMode,
    flatTaxRatePercent: config.flatTaxRatePercent?.toString() ?? null,
    applyPersonalAllowance: config.applyPersonalAllowance,
    minServiceMonths: config.minServiceMonths,
    daysPerYearOfService: config.daysPerYearOfService?.toString() ?? null,
    daysInYearBasis: config.daysInYearBasis,
    eligibilityOnFullTermOnly: config.eligibilityOnFullTermOnly,
    prorateOnEarlyExit: config.prorateOnEarlyExit,
    payTiming: config.payTiming as GratuityPolicyRecord["payTiming"],
    effectiveFrom: toDateString(config.effectiveFrom),
    effectiveTo: config.effectiveTo ? toDateString(config.effectiveTo) : null,
    versionLabel: config.versionLabel,
    sourceReference: config.sourceReference,
    isActive: config.isActive,
    isCurrent,
    taxBands: config.taxBands
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((band) => ({
        id: band.id,
        upToAmount: band.upToAmount?.toString() ?? null,
        ratePercent: band.ratePercent.toString(),
        sortOrder: band.sortOrder,
      })),
  };
}

const policyInclude = {
  taxBands: { orderBy: { sortOrder: "asc" as const } },
};

export function toGratuityPolicyInput(
  policy: GratuityPolicyRecord,
): GratuityPolicyInput {
  return {
    formulaKind: policy.formulaKind,
    defaultRatePercent: policy.defaultRatePercent,
    taxMode: policy.taxMode,
    flatTaxRatePercent: policy.flatTaxRatePercent,
    applyPersonalAllowance: policy.applyPersonalAllowance,
    minServiceMonths: policy.minServiceMonths,
    daysPerYearOfService: policy.daysPerYearOfService,
    daysInYearBasis: policy.daysInYearBasis,
    taxBands: policy.taxBands.map((band) => ({
      upToAmount: band.upToAmount,
      ratePercent: band.ratePercent,
    })),
  };
}

export async function getGratuityPolicies(): Promise<GratuityPolicyRecord[]> {
  const configs = await prisma.gratuityPolicy.findMany({
    include: policyInclude,
    orderBy: { effectiveFrom: "desc" },
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

    return mapPolicy(config, isCurrent);
  });
}

export async function getGratuityPolicyAsOf(
  asOf: Date | string,
): Promise<GratuityPolicyRecord | null> {
  const asOfKey = toStatutoryAsOfKey(asOf);
  const asOfDate = toStatutoryAsOfDate(asOfKey);

  const config = await prisma.gratuityPolicy.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    include: policyInclude,
    orderBy: { effectiveFrom: "desc" },
  });

  if (!config) {
    return null;
  }

  return mapPolicy(config, true);
}

export async function getCurrentGratuityPolicy(): Promise<GratuityPolicyRecord | null> {
  return getGratuityPolicyAsOf(new Date());
}

export async function getGratuityPolicy(
  id: string,
): Promise<GratuityPolicyRecord | null> {
  const config = await prisma.gratuityPolicy.findUnique({
    where: { id },
    include: policyInclude,
  });

  if (!config) {
    return null;
  }

  const today = toStatutoryAsOfKey(new Date());
  const isCurrent = statutoryScheduleCoversAsOf({
    effectiveFrom: toDateString(config.effectiveFrom),
    effectiveTo: config.effectiveTo ? toDateString(config.effectiveTo) : null,
    isActive: config.isActive,
    asOf: today,
  });

  return mapPolicy(config, isCurrent);
}

/** Fallback when no org policy row exists yet (matches MoF/IRD guidance). */
export function defaultTtGratuityPolicyInput(): GratuityPolicyInput {
  return {
    formulaKind: "PCT_OF_TERM_EARNINGS",
    defaultRatePercent: 20,
    taxMode: "TIERED",
    flatTaxRatePercent: null,
    applyPersonalAllowance: false,
    minServiceMonths: null,
    taxBands: TT_DEFAULT_GRATUITY_TAX_BANDS,
  };
}
