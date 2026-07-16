import { prisma } from "@/lib/prisma";
import {
  STATUTORY_RATE_TYPE_LABELS,
  type StatutoryRateRecord,
} from "@/src/modules/payroll/lib/statutory-rate-types";

export type { StatutoryRateRecord };
export { STATUTORY_RATE_TYPE_LABELS };

export async function getStatutoryRates(): Promise<StatutoryRateRecord[]> {
  const rates = await prisma.statutoryRate.findMany({
    where: {
      rateType: "PAYE",
    },
    orderBy: [{ rateType: "asc" }, { effectiveFrom: "desc" }],
    select: {
      id: true,
      rateType: true,
      ratePercent: true,
      effectiveFrom: true,
      effectiveTo: true,
      notes: true,
      isActive: true,
      updatedAt: true,
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const currentByType = new Set<string>();

  return rates.map((rate) => {
    const effectiveFrom = rate.effectiveFrom.toISOString().slice(0, 10);
    const effectiveTo = rate.effectiveTo?.toISOString().slice(0, 10) ?? null;

    const covers =
      rate.isActive &&
      effectiveFrom <= today &&
      (effectiveTo == null || effectiveTo >= today);
    const isCurrent = covers && !currentByType.has(rate.rateType);

    if (isCurrent) {
      currentByType.add(rate.rateType);
    }

    return {
      id: rate.id,
      rateType: "PAYE" as const,
      ratePercent: rate.ratePercent.toString(),
      effectiveFrom,
      effectiveTo,
      notes: rate.notes,
      isActive: rate.isActive,
      isCurrent,
      updatedAt: rate.updatedAt.toISOString(),
    };
  });
}

export async function getStatutoryRate(
  id: string,
): Promise<StatutoryRateRecord | null> {
  const rates = await getStatutoryRates();
  return rates.find((rate) => rate.id === id) ?? null;
}
