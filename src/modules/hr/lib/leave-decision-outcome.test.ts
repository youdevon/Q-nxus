import { describe, expect, it } from "vitest";

import {
  isLeaveAwaitingDecision,
  resolveLeaveDecisionOutcome,
} from "@/src/modules/hr/lib/leave-decision-outcome";

describe("resolveLeaveDecisionOutcome", () => {
  it("rejects at any step finalize to REJECTED", () => {
    expect(
      resolveLeaveDecisionOutcome({
        decision: "REJECT",
        stepNumber: 1,
        canManageLeave: false,
      }),
    ).toEqual({
      kind: "finalize",
      requestStatus: "REJECTED",
      applyBalance: "release",
    });

    expect(
      resolveLeaveDecisionOutcome({
        decision: "REJECT",
        stepNumber: 2,
        canManageLeave: true,
      }),
    ).toEqual({
      kind: "finalize",
      requestStatus: "REJECTED",
      applyBalance: "release",
    });
  });

  it("advances manager approve to HR when actor lacks leave.manage", () => {
    expect(
      resolveLeaveDecisionOutcome({
        decision: "APPROVE",
        stepNumber: 1,
        canManageLeave: false,
      }),
    ).toEqual({
      kind: "advance_to_hr",
      requestStatus: "MANAGER_APPROVED",
    });
  });

  it("finalizes when leave.manage approves the manager step", () => {
    expect(
      resolveLeaveDecisionOutcome({
        decision: "APPROVE",
        stepNumber: 1,
        canManageLeave: true,
      }),
    ).toEqual({
      kind: "finalize",
      requestStatus: "APPROVED",
      applyBalance: "approve",
    });
  });

  it("finalizes when HR confirms step 2", () => {
    expect(
      resolveLeaveDecisionOutcome({
        decision: "APPROVE",
        stepNumber: 2,
        canManageLeave: true,
      }),
    ).toEqual({
      kind: "finalize",
      requestStatus: "APPROVED",
      applyBalance: "approve",
    });
  });
});

describe("isLeaveAwaitingDecision", () => {
  it("includes manager and HR pending statuses", () => {
    expect(isLeaveAwaitingDecision("PENDING_APPROVAL")).toBe(true);
    expect(isLeaveAwaitingDecision("MANAGER_APPROVED")).toBe(true);
    expect(isLeaveAwaitingDecision("SUBMITTED")).toBe(true);
    expect(isLeaveAwaitingDecision("APPROVED")).toBe(false);
  });
});
