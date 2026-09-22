import { cache } from "react";

import { digitsOnly } from "@/src/modules/payroll/lib/ach/fcb-legacy-format";
import { defaultAchAccountLength } from "@/src/modules/payroll/lib/ach/ach-account-length-defaults";
import { getFinancialInstitutions } from "@/src/modules/payroll/data/get-financial-institutions";
import type { AchParticipantBank } from "@/src/modules/payroll/lib/ach/ach-participant-types";

export type { AchParticipantBank } from "@/src/modules/payroll/lib/ach/ach-participant-types";
export {
  achParticipantMap,
  achParticipantRegistryFromSeedRoutings,
} from "@/src/modules/payroll/lib/ach/ach-participant-types";

function toParticipant(
  row: Awaited<ReturnType<typeof getFinancialInstitutions>>[number],
): AchParticipantBank | null {
  if (!row.supportsAchCredits) {
    return null;
  }
  const routing = digitsOnly(row.routingCode ?? "");
  if (routing.length !== 9) {
    return null;
  }
  const defaults = defaultAchAccountLength(routing);
  const min = row.accountNumberMinLength ?? defaults.min;
  const max = row.accountNumberMaxLength ?? defaults.max;
  return {
    id: row.id,
    name: row.displayName,
    shortName: row.shortName,
    routing,
    accountDigits: {
      min,
      max,
      note: defaults.note,
    },
    supportsAchCredits: row.supportsAchCredits,
    isActive: row.isActive,
    catalogKey: row.catalogKey,
  };
}

/**
 * Active ACH credit participants with a 9-digit routing code.
 * Reuses the shared FinancialInstitution directory (one DB read per request).
 */
export const getAchParticipantBanks = cache(
  async function getAchParticipantBanks(): Promise<AchParticipantBank[]> {
    const rows = await getFinancialInstitutions({ activeOnly: true });
    const out: AchParticipantBank[] = [];
    for (const row of rows) {
      const participant = toParticipant(row);
      if (participant) {
        out.push(participant);
      }
    }
    return out;
  },
);
