import { describe, expect, it } from "vitest";

import {
  bothSignaturesComplete,
  canActivateContract,
  canApproveContract,
  canSignContract,
  canSubmitContract,
  contractStatusLabel,
  isContractEditable,
} from "@/src/modules/hr/lib/contract-lifecycle";
import {
  DEFAULT_CONTRACT_WORKFLOW_SETTINGS,
  parseContractWorkflowSettings,
} from "@/src/modules/hr/lib/contract-workflow-settings";

describe("contract lifecycle gates", () => {
  it("only drafts are editable and submittable", () => {
    expect(isContractEditable("DRAFT")).toBe(true);
    expect(isContractEditable("ACTIVE")).toBe(false);
    expect(canSubmitContract("DRAFT")).toBe(true);
    expect(canSubmitContract("PENDING_APPROVAL")).toBe(false);
  });

  it("approval and signature gates follow status", () => {
    expect(canApproveContract("PENDING_APPROVAL")).toBe(true);
    expect(canApproveContract("DRAFT")).toBe(false);
    expect(canSignContract("AWAITING_SIGNATURE")).toBe(true);
    expect(canSignContract("APPROVED")).toBe(true);
    expect(canSignContract("ACTIVE")).toBe(false);
  });

  it("activation allowed for draft shortcut and post-signature statuses", () => {
    expect(canActivateContract("DRAFT")).toBe(true);
    expect(canActivateContract("AWAITING_SIGNATURE")).toBe(true);
    expect(canActivateContract("ACTIVE")).toBe(false);
  });

  it("dual signature helper respects policy", () => {
    expect(
      bothSignaturesComplete({
        employeeSignedAt: new Date(),
        orgSignedAt: null,
        requireDualSignature: true,
      }),
    ).toBe(false);

    expect(
      bothSignaturesComplete({
        employeeSignedAt: new Date(),
        orgSignedAt: null,
        requireDualSignature: false,
      }),
    ).toBe(true);

    expect(
      bothSignaturesComplete({
        employeeSignedAt: new Date(),
        orgSignedAt: new Date(),
        requireDualSignature: true,
      }),
    ).toBe(true);
  });

  it("labels statuses for UI", () => {
    expect(contractStatusLabel("PENDING_APPROVAL")).toBe("Pending approval");
    expect(contractStatusLabel("AWAITING_SIGNATURE")).toBe(
      "Awaiting signature",
    );
  });
});

describe("contract workflow settings", () => {
  it("parses defaults when empty", () => {
    expect(parseContractWorkflowSettings(null)).toEqual(
      DEFAULT_CONTRACT_WORKFLOW_SETTINGS,
    );
  });

  it("parses final approver mode", () => {
    expect(
      parseContractWorkflowSettings({
        mode: "FINAL_APPROVER_POSITION",
        finalApproverPositionId: "pos_1",
        requireDualSignature: false,
      }),
    ).toEqual({
      mode: "FINAL_APPROVER_POSITION",
      finalApproverPositionId: "pos_1",
      requireDualSignature: false,
    });
  });
});
