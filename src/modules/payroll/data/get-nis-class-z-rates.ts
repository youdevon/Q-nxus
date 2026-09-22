import { prisma } from "@/lib/prisma";
import {
  type NisClassZRateRecord,
  type NisClassZVersionSummary,
  toNisClassZRateInputs,
} from "@/src/modules/payroll/lib/nis-class-z";
import {
  statutoryScheduleCoversAsOf,
  toStatutoryAsOfDate,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type { NisClassZRateRecord, NisClassZVersionSummary };
export { toNisClassZRateInputs };

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function mapNisClassZRateRecord(row: {
  id: string;
  monthlyMin: { toString(): string };
  monthlyMax: { toString(): string } | null;
  employerWeeklyAmount: { toString(): string };
  effectiveFrom: Date;
  effectiveTo: Date | null;
  versionLabel: string | null;
  isActive: boolean;
  notes: string | null;
}): NisClassZRateRecord {
  return {
    id: row.id,
    monthlyMin: row.monthlyMin.toString(),
    monthlyMax: row.monthlyMax?.toString() ?? null,
    employerWeeklyAmount: row.employerWeeklyAmount.toString(),
    effectiveFrom: toDateString(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? toDateString(row.effectiveTo) : null,
    versionLabel: row.versionLabel,
    isActive: row.isActive,
    notes: row.notes,
  };
}

export async function getNisClassZRateVersions(): Promise<
  NisClassZVersionSummary[]
> {
  const rows = await prisma.nisClassZRate.groupBy({
    by: ["effectiveFrom", "effectiveTo", "versionLabel", "isActive"],
    _count: { id: true },
    orderBy: { effectiveFrom: "desc" },
  });

  const today = toStatutoryAsOfKey(new Date());
  let currentAssigned = false;

  return rows.map((row) => {
    const effectiveFrom = toDateString(row.effectiveFrom);
    const effectiveTo = row.effectiveTo
      ? toDateString(row.effectiveTo)
      : null;
    const covers = statutoryScheduleCoversAsOf({
      effectiveFrom,
      effectiveTo,
      isActive: row.isActive,
      asOf: today,
    });
    const isCurrent = covers && !currentAssigned;
    if (isCurrent) {
      currentAssigned = true;
    }

    return {
      effectiveFrom,
      effectiveTo,
      versionLabel: row.versionLabel,
      isActive: row.isActive,
      isCurrent,
      bandCount: row._count.id,
    };
  });
}

export async function getNisClassZRatesForVersion(
  effectiveFrom: string,
): Promise<NisClassZRateRecord[]> {
  const rows = await prisma.nisClassZRate.findMany({
    where: { effectiveFrom: toStatutoryAsOfDate(effectiveFrom) },
    orderBy: [{ monthlyMin: "asc" }],
  });
  return rows.map(mapNisClassZRateRecord);
}

export async function getNisClassZRatesAsOf(
  asOf: Date | string,
): Promise<NisClassZRateRecord[]> {
  const asOfDate = toStatutoryAsOfDate(asOf);
  const anchor = await prisma.nisClassZRate.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    orderBy: [{ effectiveFrom: "desc" }],
    select: { effectiveFrom: true },
  });

  if (!anchor) {
    return [];
  }

  const rows = await prisma.nisClassZRate.findMany({
    where: {
      isActive: true,
      effectiveFrom: anchor.effectiveFrom,
    },
    orderBy: [{ monthlyMin: "asc" }],
  });

  return rows.map(mapNisClassZRateRecord);
}

export async function getCurrentNisClassZRates(): Promise<NisClassZRateRecord[]> {
  return getNisClassZRatesAsOf(new Date());
}
