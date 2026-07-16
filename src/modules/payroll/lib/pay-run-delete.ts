/**
 * Period cleanup when deleting a draft pay run.
 *
 * Create opens a period (OPEN) with the draft run. Post closes the period
 * (CLOSED). Draft delete must free the period so a new regular run can be
 * created for the same month when no runs remain.
 *
 * Correction / off-cycle drafts share a CLOSED period with a posted regular —
 * deleting them must leave the period CLOSED.
 */

export type PayrollPeriodStatus = "OPEN" | "CLOSED";

export type DraftPayRunDeletePeriodPlan =
  | { action: "delete_period"; periodId: string }
  | { action: "reopen_period"; periodId: string }
  | { action: "noop"; periodId: string };

/**
 * @param remainingPayRunCount — other pay runs still attached after this
 *   draft run is removed.
 * @param remainingPostedCount — how many of those remaining runs are POSTED.
 */
export function planPeriodAfterDraftPayRunDelete(input: {
  periodId: string;
  periodStatus: PayrollPeriodStatus;
  remainingPayRunCount: number;
  remainingPostedCount?: number;
}): DraftPayRunDeletePeriodPlan {
  const {
    periodId,
    periodStatus,
    remainingPayRunCount,
    remainingPostedCount = 0,
  } = input;

  if (remainingPayRunCount <= 0) {
    return { action: "delete_period", periodId };
  }

  // Posted history keeps the period closed (e.g. deleting a draft correction).
  if (remainingPostedCount > 0) {
    return { action: "noop", periodId };
  }

  if (periodStatus === "CLOSED") {
    return { action: "reopen_period", periodId };
  }

  return { action: "noop", periodId };
}
