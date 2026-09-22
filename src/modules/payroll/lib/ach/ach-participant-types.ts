import { defaultAchAccountLength } from "@/src/modules/payroll/lib/ach/ach-account-length-defaults";

/** Runtime ACH participant — derived from FinancialInstitution, not a separate table. */
export type AchParticipantBank = {
  id: string;
  name: string;
  shortName: string;
  routing: string;
  accountDigits: { min: number; max: number; note: string };
  supportsAchCredits: boolean;
  isActive: boolean;
  catalogKey: string | null;
};

export function achParticipantMap(
  banks: AchParticipantBank[],
): Map<string, AchParticipantBank> {
  return new Map(banks.map((bank) => [bank.routing, bank]));
}

/** Explicit registry for unit tests (no DB). */
export function achParticipantRegistryFromSeedRoutings(
  routings: readonly {
    id: string;
    name: string;
    shortName: string;
    routing: string;
    min?: number;
    max?: number;
    note?: string;
  }[],
): AchParticipantBank[] {
  return routings.map((bank) => {
    const defaults = defaultAchAccountLength(bank.routing);
    return {
      id: bank.id,
      name: bank.name,
      shortName: bank.shortName,
      routing: bank.routing,
      accountDigits: {
        min: bank.min ?? defaults.min,
        max: bank.max ?? defaults.max,
        note: bank.note ?? defaults.note,
      },
      supportsAchCredits: true,
      isActive: true,
      catalogKey: bank.id,
    };
  });
}
