import type { CorrespondenceStatus } from "@/generated/prisma/client";

import { canHrSupersedeCorrespondence } from "@/src/modules/hr/lib/correspondence-visibility";

export type SupersedeValidationInput = {
  status: CorrespondenceStatus;
  supersededById?: string | null;
};

/**
 * A letter may be superseded only once and only while issued or acknowledged.
 * The replacement must not already exist.
 */
export function canCreateSupersedingDraft(
  record: SupersedeValidationInput,
): boolean {
  if (record.supersededById) {
    return false;
  }

  return canHrSupersedeCorrespondence(record.status);
}

/** When a replacement is issued, the prior version is locked as SUPERSEDED. */
export function statusAfterSupersedingIssue(): CorrespondenceStatus {
  return "SUPERSEDED";
}
