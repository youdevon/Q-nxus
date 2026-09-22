import { prisma } from "@/lib/prisma";
import {
  type NisClassVersionSummary,
  type NisEarningsClassRecord,
  toNisClassInputs,
} from "@/src/modules/payroll/lib/nis-contribution";
import {
  statutoryScheduleCoversAsOf,
  toStatutoryAsOfDate,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type { NisClassVersionSummary, NisEarningsClassRecord };
export { toNisClassInputs };

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function mapNisClassRecord(
  row: {
    id: string;
    classCode: string;
    monthlyMin: { toString(): string };
    monthlyMax: { toString(): string } | null;
    employeeWeeklyAmount: { toString(): string };
    employerWeeklyAmount: { toString(): string };
    effectiveFrom: Date;
    effectiveTo: Date | null;
    versionLabel: string | null;
    isActive: boolean;
  },
): NisEarningsClassRecord {
  return {
    id: row.id,
    classCode: row.classCode,
    monthlyMin: row.monthlyMin.toString(),
    monthlyMax: row.monthlyMax?.toString() ?? null,
    employeeWeeklyAmount: row.employeeWeeklyAmount.toString(),
    employerWeeklyAmount: row.employerWeeklyAmount.toString(),
    effectiveFrom: toDateString(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? toDateString(row.effectiveTo) : null,
    versionLabel: row.versionLabel,
    isActive: row.isActive,
  };
}

export async function getNisClassVersions(): Promise<NisClassVersionSummary[]> {
  const rows = await prisma.nisEarningsClass.groupBy({
    by: ["effectiveFrom", "effectiveTo", "versionLabel", "isActive"],
    _count: {
      id: true,
    },
    orderBy: {
      effectiveFrom: "desc",
    },
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
      classCount: row._count.id,
    };
  });
}

export async function getNisClassesForVersion(
  effectiveFrom: string,
): Promise<NisEarningsClassRecord[]> {
  const parsed = toStatutoryAsOfDate(effectiveFrom);

  const classes = await prisma.nisEarningsClass.findMany({
    where: {
      effectiveFrom: parsed,
    },
    orderBy: {
      monthlyMin: "asc",
    },
    select: {
      id: true,
      classCode: true,
      monthlyMin: true,
      monthlyMax: true,
      employeeWeeklyAmount: true,
      employerWeeklyAmount: true,
      effectiveFrom: true,
      effectiveTo: true,
      versionLabel: true,
      isActive: true,
    },
  });

  return classes.map(mapNisClassRecord);
}

/**
 * NIS class schedule covering `asOf`.
 * Resolves the latest active version whose window includes the date.
 */
export async function getNisClassesAsOf(
  asOf: Date | string = new Date(),
): Promise<NisEarningsClassRecord[]> {
  const asOfKey = toStatutoryAsOfKey(asOf);
  const asOfDate = toStatutoryAsOfDate(asOfKey);

  const anchor = await prisma.nisEarningsClass.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
    select: { effectiveFrom: true },
  });

  if (!anchor) {
    return [];
  }

  return getNisClassesForVersion(toDateString(anchor.effectiveFrom));
}

/** @deprecated Prefer {@link getNisClassesAsOf} with an explicit period date. */
export async function getCurrentNisClasses(): Promise<NisEarningsClassRecord[]> {
  return getNisClassesAsOf(new Date());
}

/** @deprecated Prefer {@link getNisClassesAsOf}. */
export async function getActiveNisClassesAsOf(
  asOf: string = new Date().toISOString().slice(0, 10),
): Promise<NisEarningsClassRecord[]> {
  return getNisClassesAsOf(asOf);
}
