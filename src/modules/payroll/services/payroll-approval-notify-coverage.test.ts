/**
 * Inventory of payroll maker-checker / approval transitions that MUST notify
 * the users who can take the next action. Keep in sync with
 * notify-payroll-events.ts and manage-* actions.
 */
export const PAYROLL_APPROVAL_NOTIFY_EVENTS = [
  {
    event: "payRunReadyForReview",
    when: "Pay run created or approval cleared",
    recipients: "payroll.manage (exclude actor)",
  },
  {
    event: "payRunApproved",
    when: "Pay run approved (ready to post)",
    recipients: "maker + payroll.manage (exclude approver)",
  },
  {
    event: "achBatchPending",
    when: "ACH batch submitted for approval",
    recipients: "payroll.manage (exclude actor)",
  },
  {
    event: "achBatchApproved",
    when: "ACH batch approved (ready to generate)",
    recipients: "preparer + payroll.manage (exclude approver)",
  },
  {
    event: "statutoryOverridePending",
    when: "Statutory override pending approval",
    recipients: "payroll.statutory_override.approve or payroll.manage",
  },
  {
    event: "taxYearAdjustmentPending",
    when: "Tax-year adjustment pending approval",
    recipients: "payroll.tax_adjustments.approve or payroll.manage",
  },
  {
    event: "earningTreatmentPending",
    when: "Earning treatment override pending approval",
    recipients: "payroll.tax_treatment.override or payroll.manage",
  },
  {
    event: "annualProjectionReviewPending",
    when: "Annual PAYE projection submitted for review",
    recipients: "payroll.tax_projection.approve or payroll.manage",
  },
  {
    event: "annualProjectionApproved",
    when: "Projection approved — auto-applies PAYE overrides to open periods",
    recipients: "generator + payroll.tax_projection.approve or payroll.manage",
  },
  {
    event: "payeMidMonthManualRequired",
    when: "Mid-month contract end — sticky/projection PAYE skipped for that month",
    recipients:
      "payroll.statutory_override.* / tax_projection.approve / payroll.manage",
  },
] as const;

import { describe, expect, it } from "vitest";

describe("payroll approval notification coverage", () => {
  it("lists every approval queue that must notify approvers", () => {
    expect(PAYROLL_APPROVAL_NOTIFY_EVENTS.length).toBeGreaterThanOrEqual(8);
    const events = PAYROLL_APPROVAL_NOTIFY_EVENTS.map((row) => row.event);
    expect(events).toContain("payRunReadyForReview");
    expect(events).toContain("payRunApproved");
    expect(events).toContain("statutoryOverridePending");
    expect(events).toContain("taxYearAdjustmentPending");
    expect(events).toContain("earningTreatmentPending");
    expect(events).toContain("annualProjectionReviewPending");
    expect(events).toContain("annualProjectionApproved");
    expect(events).toContain("payeMidMonthManualRequired");
    expect(events).toContain("achBatchPending");
  });
});
