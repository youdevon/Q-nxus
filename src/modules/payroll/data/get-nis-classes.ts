import { prisma } from "@/lib/prisma";
import {
  type NisClassVersionSummary,
  type NisEarningsClassRecord,
  toNisClassInputs,
} from "@/src/modules/payroll/lib/nis-contribution";

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

function versionCoversToday(
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

  const today = new Date().toISOString().slice(0, 10);
  let currentAssigned = false;

  return rows.map((row) => {
    const effectiveFrom = toDateString(row.effectiveFrom);
    const effectiveTo = row.effectiveTo
      ? toDateString(row.effectiveTo)
      : null;
    const covers = versionCoversToday(
      effectiveFrom,
      effectiveTo,
      row.isActive,
      today,
    );
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
  const parsed = new Date(`${effectiveFrom}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return [];
  }

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

export async function getCurrentNisClasses(): Promise<NisEarningsClassRecord[]> {
  const versions = await getNisClassVersions();
  const current = versions.find((version) => version.isCurrent);

  if (!current) {
    return [];
  }

  return getNisClassesForVersion(current.effectiveFrom);
}

export async function getActiveNisClassesAsOf(
  asOf: string = new Date().toISOString().slice(0, 10),
): Promise<NisEarningsClassRecord[]> {
  const versions = await getNisClassVersions();
  const activeVersion = versions.find((version) =>
    versionCoversToday(
      version.effectiveFrom,
      version.effectiveTo,
      version.isActive,
      asOf,
    ),
  );

  if (!activeVersion) {
    return [];
  }

  return getNisClassesForVersion(activeVersion.effectiveFrom);
}
