import { describe, expect, it } from "vitest";

import { normalizeRelatedNotificationRefs } from "./purge-related-notifications";

describe("normalizeRelatedNotificationRefs", () => {
  it("keeps PayRun, batch, and payslip refs and drops blanks/duplicates", () => {
    expect(
      normalizeRelatedNotificationRefs([
        { relatedType: "PayRun", relatedId: "run-1" },
        { relatedType: "AchPaymentBatch", relatedId: "batch-1" },
        { relatedType: "Payslip", relatedId: "slip-1" },
        { relatedType: "PayRun", relatedId: "run-1" },
        { relatedType: "  ", relatedId: "x" },
        { relatedType: "PayRun", relatedId: "" },
      ]),
    ).toEqual([
      { relatedType: "PayRun", relatedId: "run-1" },
      { relatedType: "AchPaymentBatch", relatedId: "batch-1" },
      { relatedType: "Payslip", relatedId: "slip-1" },
    ]);
  });
});
