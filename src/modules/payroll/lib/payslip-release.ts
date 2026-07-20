/**
 * Payslip release + secure delivery helpers (Payroll Phase C).
 *
 * Status stays POSTED (frozen calc). Release is a separate gate via
 * `releasedAt` / `emailDeliveryStatus` before employee self-service + email.
 */

import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";

export const PAYSLIP_EMAIL_DELIVERY_STATUSES = [
  "PENDING",
  "SENT",
  "FAILED",
  "SKIPPED",
] as const;

export type PayslipEmailDeliveryStatusValue =
  (typeof PAYSLIP_EMAIL_DELIVERY_STATUSES)[number];

export type PayslipReleaseRow = {
  status: string;
  releasedAt: Date | string | null;
  emailDeliveryStatus?: PayslipEmailDeliveryStatusValue | null;
};

/** Absolute self-service URL for a released payslip. */
export function buildPayslipSecureUrl(
  payslipId: string,
  baseUrl?: string | null,
): string {
  const trimmedId = payslipId.trim();
  if (!trimmedId) {
    throw new Error("Payslip id is required.");
  }

  const rawBase =
    (baseUrl ?? process.env.APP_BASE_URL)?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const path = `/me/payslip?payslipId=${encodeURIComponent(trimmedId)}`;

  if (rawBase.startsWith("http://") || rawBase.startsWith("https://")) {
    return `${rawBase}${path}`;
  }

  return `http://${rawBase}${path}`;
}

/** Posted (or later) runs may release payslips. */
export function canReleasePayRunPayslips(payRunStatus: string): boolean {
  return isPayRunPosted(payRunStatus);
}

/** POSTED and not yet released. */
export function isPayslipEligibleForRelease(row: PayslipReleaseRow): boolean {
  return row.status === "POSTED" && row.releasedAt == null;
}

export type PayslipDeliverySummary = {
  postedCount: number;
  releasedCount: number;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  unreleasedCount: number;
};

export function summarizePayslipDelivery(
  rows: PayslipReleaseRow[],
): PayslipDeliverySummary {
  const summary: PayslipDeliverySummary = {
    postedCount: 0,
    releasedCount: 0,
    pendingCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    unreleasedCount: 0,
  };

  for (const row of rows) {
    if (row.status !== "POSTED") {
      continue;
    }

    summary.postedCount += 1;

    if (row.releasedAt == null) {
      summary.unreleasedCount += 1;
      continue;
    }

    summary.releasedCount += 1;

    switch (row.emailDeliveryStatus) {
      case "PENDING":
        summary.pendingCount += 1;
        break;
      case "SENT":
        summary.sentCount += 1;
        break;
      case "FAILED":
        summary.failedCount += 1;
        break;
      case "SKIPPED":
        summary.skippedCount += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}

/** Map email-queue terminal status onto payslip delivery status. */
export function payslipDeliveryStatusFromEmailQueue(
  emailStatus: string,
): PayslipEmailDeliveryStatusValue | null {
  if (emailStatus === "SENT") {
    return "SENT";
  }
  if (emailStatus === "FAILED") {
    return "FAILED";
  }
  if (emailStatus === "PENDING" || emailStatus === "PROCESSING") {
    return "PENDING";
  }
  return null;
}
