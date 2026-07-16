import { prisma } from "@/lib/prisma";
import {
  type PayeTaxConfigRecord,
  toPayeConfigInput,
} from "@/src/modules/payroll/lib/paye-contribution";

export type {
  PayeTaxBracketRecord,
  PayeTaxConfigRecord,
} from "@/src/modules/payroll/lib/paye-contribution";
export { toPayeConfigInput };

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

export async function getPayeTaxConfigs(): Promise<PayeTaxConfigRecord[]> {
  const configs = await prisma.payeTaxConfig.findMany({
    orderBy: { effectiveFrom: "desc" },
    include: {
      brackets: {
        orderBy: { sortOrder: "asc" },
      },
    },
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
      personalAllowanceAnnual: config.personalAllowanceAnnual.toString(),
      nisDeductiblePortion: config.nisDeductiblePortion.toString(),
      approvedDeductionCapAnnual: config.approvedDeductionCapAnnual.toString(),
      effectiveFrom,
      effectiveTo,
      versionLabel: config.versionLabel,
      isActive: config.isActive,
      isCurrent,
      brackets: config.brackets.map((bracket) => ({
        id: bracket.id,
        upToAmount: bracket.upToAmount?.toString() ?? null,
        ratePercent: bracket.ratePercent.toString(),
        sortOrder: bracket.sortOrder,
      })),
    };
  });
}

export async function getCurrentPayeTaxConfig(): Promise<PayeTaxConfigRecord | null> {
  const configs = await getPayeTaxConfigs();
  return configs.find((config) => config.isCurrent) ?? null;
}

export async function getPayeTaxConfig(
  id: string,
): Promise<PayeTaxConfigRecord | null> {
  const configs = await getPayeTaxConfigs();
  return configs.find((config) => config.id === id) ?? null;
}
