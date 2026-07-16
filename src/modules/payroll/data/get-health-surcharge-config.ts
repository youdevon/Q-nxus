import { prisma } from "@/lib/prisma";
import {
  type HealthSurchargeConfigRecord,
  toHealthConfigInput,
} from "@/src/modules/payroll/lib/health-surcharge";

export type { HealthSurchargeConfigRecord };
export { toHealthConfigInput };

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function coversToday(
  effectiveFrom: string,
  effectiveTo: string | null,
  isActive: boolean,
  today: string,
): boolean {
  return (
    isActive &&
    effectiveFrom <= today &&
    (effectiveTo == null || effectiveTo >= today)
  );
}

export async function getHealthSurchargeConfigs(): Promise<
  HealthSurchargeConfigRecord[]
> {
  const configs = await prisma.healthSurchargeConfig.findMany({
    orderBy: { effectiveFrom: "desc" },
  });

  const today = new Date().toISOString().slice(0, 10);
  let currentAssigned = false;

  return configs.map((config) => {
    const effectiveFrom = toDateString(config.effectiveFrom);
    const effectiveTo = config.effectiveTo
      ? toDateString(config.effectiveTo)
      : null;
    const isCurrent =
      coversToday(effectiveFrom, effectiveTo, config.isActive, today) &&
      !currentAssigned;

    if (isCurrent) {
      currentAssigned = true;
    }

    return {
      id: config.id,
      higherWeeklyAmount: config.higherWeeklyAmount.toString(),
      lowerWeeklyAmount: config.lowerWeeklyAmount.toString(),
      weeklyEarningsThreshold: config.weeklyEarningsThreshold.toString(),
      monthlyEarningsThreshold: config.monthlyEarningsThreshold.toString(),
      underAgeExempt: config.underAgeExempt,
      seniorAgeExempt: config.seniorAgeExempt,
      effectiveFrom,
      effectiveTo,
      versionLabel: config.versionLabel,
      isActive: config.isActive,
      isCurrent,
    };
  });
}

export async function getCurrentHealthSurchargeConfig(): Promise<HealthSurchargeConfigRecord | null> {
  const configs = await getHealthSurchargeConfigs();
  return configs.find((config) => config.isCurrent) ?? null;
}

export async function getHealthSurchargeConfig(
  id: string,
): Promise<HealthSurchargeConfigRecord | null> {
  const configs = await getHealthSurchargeConfigs();
  return configs.find((config) => config.id === id) ?? null;
}
