import { prisma } from "@/lib/prisma";
import {
  DEFAULT_NIS_ELIGIBILITY,
  type NisEligibilityConfigInput,
} from "@/src/modules/payroll/lib/nis-eligibility";
import { toStatutoryAsOfDate } from "@/src/modules/payroll/lib/statutory-as-of";

export type NisEligibilityConfigRecord = {
  id: string;
  fullRetirementAge: number;
  earlyRetirementAge: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  versionLabel: string | null;
  isActive: boolean;
  notes: string | null;
};

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toNisEligibilityConfigInput(
  record: NisEligibilityConfigRecord,
): NisEligibilityConfigInput {
  return {
    fullRetirementAge: record.fullRetirementAge,
    earlyRetirementAge: record.earlyRetirementAge,
  };
}

export async function getNisEligibilityConfigAsOf(
  asOf: Date | string,
): Promise<NisEligibilityConfigRecord | null> {
  const asOfDate = toStatutoryAsOfDate(asOf);
  const row = await prisma.nisEligibilityConfig.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    orderBy: [{ effectiveFrom: "desc" }],
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fullRetirementAge: row.fullRetirementAge,
    earlyRetirementAge: row.earlyRetirementAge,
    effectiveFrom: toDateString(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? toDateString(row.effectiveTo) : null,
    versionLabel: row.versionLabel,
    isActive: row.isActive,
    notes: row.notes,
  };
}

export async function resolveNisEligibilityConfigInput(
  asOf: Date | string,
): Promise<NisEligibilityConfigInput> {
  const config = await getNisEligibilityConfigAsOf(asOf);
  return config ? toNisEligibilityConfigInput(config) : DEFAULT_NIS_ELIGIBILITY;
}
