import { describe, expect, it } from "vitest";

import {
  isLeaveAwaitingApprovalDecision,
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
        mode: "MANAGER_THEN_HR",
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
        mode: "MANAGER_THEN_HR",
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
        mode: "MANAGER_THEN_HR",
      }),
    ).toEqual({
      kind: "finalize",
      requestStatus: "APPROVED",
      applyBalance: "approve",
    });
  });

  it("finalizes directly for DIRECT_MANAGER", () => {
    expect(
      resolveLeaveDecisionOutcome({
        decision: "APPROVE",
        stepNumber: 1,
        canManageLeave: false,
        mode: "DIRECT_MANAGER",
      }),
    ).toEqual({
      kind: "finalize",
      requestStatus: "APPROVED",
      applyBalance: "approve",
    });
  });

  it("advances to final for MANAGER_THEN_FINAL", () => {
    expect(
      resolveLeaveDecisionOutcome({
        decision: "APPROVE",
        stepNumber: 1,
        canManageLeave: false,
        mode: "MANAGER_THEN_FINAL",
      }),
    ).toEqual({
      kind: "advance_to_final",
      requestStatus: "PENDING_APPROVAL",
    });
  });

  it("finalizes for REPORTING_LINE_ACK_THEN_FINAL", () => {
    expect(
      resolveLeaveDecisionOutcome({
        decision: "APPROVE",
        stepNumber: 1,
        canManageLeave: false,
        mode: "REPORTING_LINE_ACK_THEN_FINAL",
      }),
    ).toEqual({
      kind: "finalize",
      requestStatus: "APPROVED",
      applyBalance: "approve",
    });
  });
});

describe("isLeaveAwaitingDecision", () => {
  it("includes acknowledgement and approval pending statuses", () => {
    expect(isLeaveAwaitingDecision("PENDING_APPROVAL")).toBe(true);
    expect(isLeaveAwaitingDecision("AWAITING_ACKNOWLEDGEMENT")).toBe(true);
    expect(isLeaveAwaitingDecision("MANAGER_APPROVED")).toBe(true);
    expect(isLeaveAwaitingDecision("SUBMITTED")).toBe(true);
    expect(isLeaveAwaitingDecision("APPROVED")).toBe(false);
  });

  it("excludes acknowledgement from approval decisions", () => {
    expect(isLeaveAwaitingApprovalDecision("AWAITING_ACKNOWLEDGEMENT")).toBe(
      false,
    );
    expect(isLeaveAwaitingApprovalDecision("PENDING_APPROVAL")).toBe(true);
  });
});
