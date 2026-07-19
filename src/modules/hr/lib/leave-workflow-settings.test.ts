import { describe, expect, it } from "vitest";

import {
  DEFAULT_LEAVE_WORKFLOW_SETTINGS,
  leaveWorkflowRequiresFinalApprover,
  leaveWorkflowUsesAcknowledgements,
  parseLeaveWorkflowSettings,
} from "@/src/modules/hr/lib/leave-workflow-settings";

describe("parseLeaveWorkflowSettings", () => {
  it("returns defaults for invalid input", () => {
    expect(parseLeaveWorkflowSettings(null)).toEqual(
      DEFAULT_LEAVE_WORKFLOW_SETTINGS,
    );
    expect(parseLeaveWorkflowSettings("nope")).toEqual(
      DEFAULT_LEAVE_WORKFLOW_SETTINGS,
    );
  });

  it("parses a valid JSON object", () => {
    expect(
      parseLeaveWorkflowSettings({
        mode: "REPORTING_LINE_ACK_THEN_FINAL",
        finalApproverPositionId: "pos_gm",
        requireAllAcksBeforeFinal: true,
        ackOrder: "ANY",
      }),
    ).toEqual({
      mode: "REPORTING_LINE_ACK_THEN_FINAL",
      finalApproverPositionId: "pos_gm",
      requireAllAcksBeforeFinal: true,
      ackOrder: "ANY",
    });
  });

  it("ignores unknown modes and blank position ids", () => {
    expect(
      parseLeaveWorkflowSettings({
        mode: "UNKNOWN",
        finalApproverPositionId: "   ",
        requireAllAcksBeforeFinal: false,
        ackOrder: "SEQUENTIAL",
      }),
    ).toEqual({
      mode: "MANAGER_THEN_HR",
      finalApproverPositionId: null,
      requireAllAcksBeforeFinal: false,
      ackOrder: "SEQUENTIAL",
    });
  });
});

describe("leaveWorkflowRequiresFinalApprover", () => {
  it("requires a configured final position for ack/final modes", () => {
    expect(leaveWorkflowRequiresFinalApprover("MANAGER_THEN_HR")).toBe(false);
    expect(leaveWorkflowRequiresFinalApprover("DIRECT_MANAGER")).toBe(false);
    expect(
      leaveWorkflowRequiresFinalApprover("REPORTING_LINE_ACK_THEN_FINAL"),
    ).toBe(true);
    expect(leaveWorkflowRequiresFinalApprover("FINAL_ONLY")).toBe(true);
    expect(leaveWorkflowRequiresFinalApprover("MANAGER_THEN_FINAL")).toBe(true);
  });
});

describe("leaveWorkflowUsesAcknowledgements", () => {
  it("only the reporting-line ack mode creates acknowledgements", () => {
    expect(leaveWorkflowUsesAcknowledgements("MANAGER_THEN_HR")).toBe(false);
    expect(
      leaveWorkflowUsesAcknowledgements("REPORTING_LINE_ACK_THEN_FINAL"),
    ).toBe(true);
  });
});
