/**
 * Org-scoped leave approval workflow settings (DomainSetting `leave.workflow`).
 *
 * Final approver is resolved by Position id (recommended: the General Manager
 * position). Mode controls acknowledgements vs direct approval.
 */

export const LEAVE_WORKFLOW_SETTING_CODE = "leave.workflow";

export const LEAVE_WORKFLOW_MODES = [
  "MANAGER_THEN_HR",
  "DIRECT_MANAGER",
  "REPORTING_LINE_ACK_THEN_FINAL",
  "FINAL_ONLY",
  "MANAGER_THEN_FINAL",
] as const;

export type LeaveWorkflowMode = (typeof LEAVE_WORKFLOW_MODES)[number];

export type LeaveAckOrder = "ANY" | "SEQUENTIAL";

export type LeaveWorkflowSettings = {
  mode: LeaveWorkflowMode;
  /** Position id of the final leave approver (e.g. General Manager). */
  finalApproverPositionId: string | null;
  /** When true, final approver cannot act until all acks are done. */
  requireAllAcksBeforeFinal: boolean;
  /**
   * ANY: all assigned people may acknowledge in any order; final waits for all.
   * SEQUENTIAL: only the next pending sequence may acknowledge.
   */
  ackOrder: LeaveAckOrder;
};

export const DEFAULT_LEAVE_WORKFLOW_SETTINGS: LeaveWorkflowSettings = {
  mode: "MANAGER_THEN_HR",
  finalApproverPositionId: null,
  requireAllAcksBeforeFinal: true,
  ackOrder: "ANY",
};

const MODE_SET = new Set<string>(LEAVE_WORKFLOW_MODES);

export function isLeaveWorkflowMode(value: unknown): value is LeaveWorkflowMode {
  return typeof value === "string" && MODE_SET.has(value);
}

export function parseLeaveWorkflowSettings(
  value: unknown,
): LeaveWorkflowSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_LEAVE_WORKFLOW_SETTINGS };
  }

  const record = value as Record<string, unknown>;
  const mode = isLeaveWorkflowMode(record.mode)
    ? record.mode
    : DEFAULT_LEAVE_WORKFLOW_SETTINGS.mode;

  const finalApproverPositionId =
    typeof record.finalApproverPositionId === "string" &&
    record.finalApproverPositionId.trim().length > 0
      ? record.finalApproverPositionId.trim()
      : null;

  const requireAllAcksBeforeFinal =
    typeof record.requireAllAcksBeforeFinal === "boolean"
      ? record.requireAllAcksBeforeFinal
      : DEFAULT_LEAVE_WORKFLOW_SETTINGS.requireAllAcksBeforeFinal;

  const ackOrder =
    record.ackOrder === "SEQUENTIAL" || record.ackOrder === "ANY"
      ? record.ackOrder
      : DEFAULT_LEAVE_WORKFLOW_SETTINGS.ackOrder;

  return {
    mode,
    finalApproverPositionId,
    requireAllAcksBeforeFinal,
    ackOrder,
  };
}

export function leaveWorkflowRequiresFinalApprover(
  mode: LeaveWorkflowMode,
): boolean {
  return (
    mode === "REPORTING_LINE_ACK_THEN_FINAL" ||
    mode === "FINAL_ONLY" ||
    mode === "MANAGER_THEN_FINAL"
  );
}

export function leaveWorkflowUsesAcknowledgements(
  mode: LeaveWorkflowMode,
): boolean {
  return mode === "REPORTING_LINE_ACK_THEN_FINAL";
}

export function leaveWorkflowModeLabel(mode: LeaveWorkflowMode): string {
  switch (mode) {
    case "MANAGER_THEN_HR":
      return "Manager then HR";
    case "DIRECT_MANAGER":
      return "Direct manager only";
    case "REPORTING_LINE_ACK_THEN_FINAL":
      return "Reporting-line acknowledgement, then final approver";
    case "FINAL_ONLY":
      return "Final approver only";
    case "MANAGER_THEN_FINAL":
      return "Manager then final approver";
    default:
      return mode;
  }
}
