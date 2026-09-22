import { prisma } from "@/lib/prisma";
import {
  type HealthSurchargeConfigRecord,
  toHealthConfigInput,
} from "@/src/modules/payroll/lib/health-surcharge";
import {
  statutoryScheduleCoversAsOf,
  toStatutoryAsOfDate,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type { HealthSurchargeConfigRecord };
export { toHealthConfigInput };

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapHealthConfig(
  config: {
    id: string;
    higherWeeklyAmount: { toString(): string };
    lowerWeeklyAmount: { toString(): string };
    weeklyEarningsThreshold: { toString(): string };
    monthlyEarningsThreshold: { toString(): string };
    underAgeExempt: number;
    seniorAgeExempt: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    versionLabel: string | null;
    isActive: boolean;
  },
  isCurrent: boolean,
): HealthSurchargeConfigRecord {
  return {
    id: config.id,
    higherWeeklyAmount: config.higherWeeklyAmount.toString(),
    lowerWeeklyAmount: config.lowerWeeklyAmount.toString(),
    weeklyEarningsThreshold: config.weeklyEarningsThreshold.toString(),
    monthlyEarningsThreshold: config.monthlyEarningsThreshold.toString(),
    underAgeExempt: config.underAgeExempt,
    seniorAgeExempt: config.seniorAgeExempt,
    effectiveFrom: toDateString(config.effectiveFrom),
    effectiveTo: config.effectiveTo ? toDateString(config.effectiveTo) : null,
    versionLabel: config.versionLabel,
    isActive: config.isActive,
    isCurrent,
  };
}

export async function getHealthSurchargeConfigs(): Promise<
  HealthSurchargeConfigRecord[]
> {
  const configs = await prisma.healthSurchargeConfig.findMany({
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

    return mapHealthConfig(config, isCurrent);
  });
}

export async function getHealthSurchargeConfigAsOf(
  asOf: Date | string,
): Promise<HealthSurchargeConfigRecord | null> {
  const asOfKey = toStatutoryAsOfKey(asOf);
  const asOfDate = toStatutoryAsOfDate(asOfKey);

  const config = await prisma.healthSurchargeConfig.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!config) {
    return null;
  }

  return mapHealthConfig(config, true);
}

/** @deprecated Prefer {@link getHealthSurchargeConfigAsOf} with an explicit period date. */
export async function getCurrentHealthSurchargeConfig(): Promise<HealthSurchargeConfigRecord | null> {
  return getHealthSurchargeConfigAsOf(new Date());
}

export async function getHealthSurchargeConfig(
  id: string,
): Promise<HealthSurchargeConfigRecord | null> {
  const config = await prisma.healthSurchargeConfig.findUnique({
    where: { id },
  });

  if (!config) {
    return null;
  }

  const today = toStatutoryAsOfKey(new Date());
  const effectiveFrom = toDateString(config.effectiveFrom);
  const effectiveTo = config.effectiveTo
    ? toDateString(config.effectiveTo)
    : null;

  return mapHealthConfig(
    config,
    statutoryScheduleCoversAsOf({
      effectiveFrom,
      effectiveTo,
      isActive: config.isActive,
      asOf: today,
    }),
  );
}
