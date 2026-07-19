import type { LeaveWorkflowMode } from "@/src/modules/hr/lib/leave-workflow-settings";

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
    }
  | {
      kind: "advance_to_final";
      requestStatus: "PENDING_APPROVAL";
    };

/**
 * Resolves leave decision outcomes for the configured workflow mode.
 *
 * - Reject at any step finalizes as REJECTED.
 * - MANAGER_THEN_HR: manager approve (step 1, without leave.manage) → HR.
 * - DIRECT_MANAGER: manager approve finalizes.
 * - MANAGER_THEN_FINAL: manager approve → final approver step.
 * - FINAL_ONLY / REPORTING_LINE_ACK_THEN_FINAL: single final step finalizes.
 * - leave.manage approve may finalize early on manager steps.
 */
export function resolveLeaveDecisionOutcome(input: {
  decision: LeaveDecision;
  stepNumber: number;
  canManageLeave: boolean;
  mode?: LeaveWorkflowMode;
}): LeaveDecisionOutcome {
  if (input.decision === "REJECT") {
    return {
      kind: "finalize",
      requestStatus: "REJECTED",
      applyBalance: "release",
    };
  }

  const mode = input.mode ?? "MANAGER_THEN_HR";
  const isManagerStep = input.stepNumber === 1;

  if (mode === "DIRECT_MANAGER") {
    return {
      kind: "finalize",
      requestStatus: "APPROVED",
      applyBalance: "approve",
    };
  }

  if (mode === "FINAL_ONLY" || mode === "REPORTING_LINE_ACK_THEN_FINAL") {
    return {
      kind: "finalize",
      requestStatus: "APPROVED",
      applyBalance: "approve",
    };
  }

  if (mode === "MANAGER_THEN_FINAL") {
    if (isManagerStep && !input.canManageLeave) {
      return {
        kind: "advance_to_final",
        requestStatus: "PENDING_APPROVAL",
      };
    }

    return {
      kind: "finalize",
      requestStatus: "APPROVED",
      applyBalance: "approve",
    };
  }

  // MANAGER_THEN_HR (default / legacy)
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
    status === "AWAITING_ACKNOWLEDGEMENT" ||
    status === "PENDING_APPROVAL" ||
    status === "MANAGER_APPROVED"
  );
}

/** Statuses where approve/reject (not acknowledge) is the next action. */
export function isLeaveAwaitingApprovalDecision(status: string): boolean {
  return (
    status === "SUBMITTED" ||
    status === "PENDING_APPROVAL" ||
    status === "MANAGER_APPROVED"
  );
}
