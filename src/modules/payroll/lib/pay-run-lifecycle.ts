/**
 * Pay-run lifecycle helpers.
 *
 * DRAFT → APPROVED → POSTED → RECONCILED → CLOSED
 *
 * DRAFT     — working paysheet; calculate, adjust, exclude/re-include
 * APPROVED  — paysheet locked for posting; figures/membership frozen
 *             Recalculate unlocks back to DRAFT and clears approval
 * POSTED+   — amounts frozen permanently
 */

export const PAY_RUN_STATUSES = [
  "DRAFT",
  "APPROVED",
  "POSTED",
  "RECONCILED",
  "CLOSED",
] as const;

export type PayRunLifecycleStatus = (typeof PAY_RUN_STATUSES)[number];

/**
 * Run is still open (not frozen by post). Recalculate and delete are allowed.
 * Does not imply line-item / membership edits — see `isPayRunEditable`.
 */
export function isPayRunMutable(status: string): boolean {
  return status === "DRAFT" || status === "APPROVED";
}

/**
 * Paysheet figures and membership may be edited.
 * APPROVED is intentionally not editable — Recalculate first to unlock.
 */
export function isPayRunEditable(status: string): boolean {
  return status === "DRAFT";
}

/** Figures frozen; payment/export allowed. */
export function isPayRunPosted(status: string): boolean {
  return status === "POSTED" || status === "RECONCILED" || status === "CLOSED";
}

export function isPayRunClosed(status: string): boolean {
  return status === "CLOSED";
}

export function canApprovePayRun(status: string): boolean {
  return status === "DRAFT";
}

/** Recalculate is the unlock path from APPROVED as well as the draft refresh. */
export function canRecalculatePayRun(status: string): boolean {
  return isPayRunMutable(status);
}

/** Posting requires an approved paysheet — no draft shortcut. */
export function canPostPayRun(status: string): boolean {
  return status === "APPROVED";
}

export function canReconcilePayRun(status: string): boolean {
  return status === "POSTED";
}

export function canClosePayRun(status: string): boolean {
  return status === "RECONCILED" || status === "POSTED";
}

/**
 * Delete is allowed in every lifecycle status so test environments can wipe
 * approved / posted / closed runs and re-run the same period. Production
 * callers should still treat this as destructive.
 */
export function canDeletePayRun(status: string): boolean {
  return PAY_RUN_STATUSES.includes(status as PayRunLifecycleStatus);
}

export function payRunStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "APPROVED":
      return "Approved";
    case "POSTED":
      return "Posted";
    case "RECONCILED":
      return "Reconciled";
    case "CLOSED":
      return "Closed";
    default:
      return status;
  }
}
