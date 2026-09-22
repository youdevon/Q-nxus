import { describe, expect, it } from "vitest";

import { normalizeRelatedNotificationRefs } from "@/src/modules/notifications/services/purge-related-notifications";

/**
 * Shape of soft refs collected before employment-contract hard delete.
 * Mirrors collectEmploymentContractDeleteDependents output composition.
 */
function buildContractDeleteNotificationRefs(input: {
  contractIds: string[];
  leaveRequestIds: string[];
}) {
  return normalizeRelatedNotificationRefs([
    ...input.contractIds.map((relatedId) => ({
      relatedType: "EmploymentContract",
      relatedId,
    })),
    ...input.leaveRequestIds.map((relatedId) => ({
      relatedType: "LeaveRequest",
      relatedId,
    })),
  ]);
}

describe("employment contract delete notification refs", () => {
  it("includes the contract and its leave requests", () => {
    expect(
      buildContractDeleteNotificationRefs({
        contractIds: ["c1", "c2"],
        leaveRequestIds: ["lr1"],
      }),
    ).toEqual([
      { relatedType: "EmploymentContract", relatedId: "c1" },
      { relatedType: "EmploymentContract", relatedId: "c2" },
      { relatedType: "LeaveRequest", relatedId: "lr1" },
    ]);
  });
});
