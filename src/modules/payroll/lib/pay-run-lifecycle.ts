/**
 * Pay-run lifecycle helpers.
 *
 * DRAFT → APPROVED → POSTED → RECONCILED → CLOSED
 * Recalculation always returns the run to DRAFT and clears approval.
 */

export const PAY_RUN_STATUSES = [
  "DRAFT",
  "APPROVED",
  "POSTED",
  "RECONCILED",
  "CLOSED",
] as const;

export type PayRunLifecycleStatus = (typeof PAY_RUN_STATUSES)[number];

/** Amounts and membership may still be edited. */
export function isPayRunMutable(status: string): boolean {
  return status === "DRAFT" || status === "APPROVED";
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

export function canPostPayRun(status: string): boolean {
  return status === "APPROVED" || status === "DRAFT";
}

export function canReconcilePayRun(status: string): boolean {
  return status === "POSTED";
}

export function canClosePayRun(status: string): boolean {
  return status === "RECONCILED" || status === "POSTED";
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
