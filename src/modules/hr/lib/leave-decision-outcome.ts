export type LeaveDecision = "APPROVE" | "REJECT";

export type LeaveDecisionOutcome =
  | {
      kind: "finalize";
      requestStatus: "APPROVED" | "REJECTED";
      applyBalance: "approve" | "release";
    }
  | {
      kind: "advance_to_hr";
      requestStatus: "MANAGER_APPROVED";
    };

/**
 * Resolves manager → HR leave handling.
 *
 * - Reject at any step finalizes as REJECTED.
 * - Manager approve on step 1 (without leave.manage) advances to HR.
 * - leave.manage approve (any step) or HR step confirm finalizes as APPROVED.
 */
export function resolveLeaveDecisionOutcome(input: {
  decision: LeaveDecision;
  stepNumber: number;
  canManageLeave: boolean;
}): LeaveDecisionOutcome {
  if (input.decision === "REJECT") {
    return {
      kind: "finalize",
      requestStatus: "REJECTED",
      applyBalance: "release",
    };
  }

  const isManagerStep = input.stepNumber === 1;

  if (isManagerStep && !input.canManageLeave) {
    return {
      kind: "advance_to_hr",
      requestStatus: "MANAGER_APPROVED",
    };
  }

  return {
    kind: "finalize",
    requestStatus: "APPROVED",
    applyBalance: "approve",
  };
}

export function isLeaveAwaitingDecision(status: string): boolean {
  return (
    status === "SUBMITTED" ||
    status === "PENDING_APPROVAL" ||
    status === "MANAGER_APPROVED"
  );
}
