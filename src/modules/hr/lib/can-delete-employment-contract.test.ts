import { describe, expect, it } from "vitest";

import { canDeleteEmploymentContract } from "@/src/modules/hr/lib/can-delete-employment-contract";

const clear = {
  hasChildAmendments: false,
  leaveRequestCount: 0,
  hasLeaveUsage: false,
  hasPostedPayrollOverlap: false,
};

describe("canDeleteEmploymentContract", () => {
  it("allows delete when the contract is unused and has no successors", () => {
    expect(canDeleteEmploymentContract(clear)).toEqual({ allowed: true });
  });

  it("blocks delete when a later amendment references the contract", () => {
    expect(
      canDeleteEmploymentContract({
        ...clear,
        hasChildAmendments: true,
      }),
    ).toEqual({
      allowed: false,
      reason:
        "This contract was superseded by a later version. Delete the latest unused contract first.",
    });
  });

  it("blocks delete when leave requests exist", () => {
    expect(
      canDeleteEmploymentContract({
        ...clear,
        leaveRequestCount: 2,
      }),
    ).toEqual({
      allowed: false,
      reason:
        "This contract has leave requests and cannot be deleted. Prefer amend or close instead.",
    });
  });

  it("blocks delete when leave balances show usage", () => {
    expect(
      canDeleteEmploymentContract({
        ...clear,
        hasLeaveUsage: true,
      }),
    ).toEqual({
      allowed: false,
      reason:
        "This contract has leave usage recorded and cannot be deleted. Prefer amend or close instead.",
    });
  });

  it("blocks delete when posted payroll overlaps the contract period", () => {
    expect(
      canDeleteEmploymentContract({
        ...clear,
        hasPostedPayrollOverlap: true,
      }),
    ).toEqual({
      allowed: false,
      reason:
        "This contract overlaps a posted pay period for the employee and cannot be deleted. Prefer amend instead.",
    });
  });
});
