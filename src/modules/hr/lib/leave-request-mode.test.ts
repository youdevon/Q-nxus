import { describe, expect, it } from "vitest";

import {
  canRequestLeaveOnBehalf,
  isLeaveRequestMode,
  resolveLeaveRequestTargetEmployeeId,
} from "@/src/modules/hr/lib/leave-request-mode";

describe("isLeaveRequestMode", () => {
  it("accepts self and onBehalf", () => {
    expect(isLeaveRequestMode("self")).toBe(true);
    expect(isLeaveRequestMode("onBehalf")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isLeaveRequestMode("")).toBe(false);
    expect(isLeaveRequestMode("other")).toBe(false);
  });
});

describe("canRequestLeaveOnBehalf", () => {
  it("requires leave.manage", () => {
    expect(canRequestLeaveOnBehalf((code) => code === "leave.manage")).toBe(
      true,
    );
    expect(canRequestLeaveOnBehalf((code) => code === "leave.request")).toBe(
      false,
    );
    expect(canRequestLeaveOnBehalf((code) => code === "leave.approve")).toBe(
      false,
    );
  });
});

describe("resolveLeaveRequestTargetEmployeeId", () => {
  it("uses the actor employee for self mode", () => {
    expect(
      resolveLeaveRequestTargetEmployeeId({
        mode: "self",
        actorEmployeeId: "emp-1",
        submittedEmployeeId: "emp-other",
      }),
    ).toEqual({ ok: true, employeeId: "emp-1" });
  });

  it("rejects self mode without a linked employee", () => {
    expect(
      resolveLeaveRequestTargetEmployeeId({
        mode: "self",
        actorEmployeeId: null,
        submittedEmployeeId: null,
      }),
    ).toEqual({
      ok: false,
      message: "Your user account is not linked to an employee record.",
    });
  });

  it("requires a selected employee for on-behalf mode", () => {
    expect(
      resolveLeaveRequestTargetEmployeeId({
        mode: "onBehalf",
        actorEmployeeId: "emp-hr",
        submittedEmployeeId: null,
      }),
    ).toEqual({
      ok: false,
      message: "Select the employee this leave request is for.",
    });
  });

  it("rejects on-behalf when the target is the actor", () => {
    expect(
      resolveLeaveRequestTargetEmployeeId({
        mode: "onBehalf",
        actorEmployeeId: "emp-1",
        submittedEmployeeId: "emp-1",
      }).ok,
    ).toBe(false);
  });

  it("accepts a different employee for on-behalf", () => {
    expect(
      resolveLeaveRequestTargetEmployeeId({
        mode: "onBehalf",
        actorEmployeeId: "emp-hr",
        submittedEmployeeId: "emp-2",
      }),
    ).toEqual({ ok: true, employeeId: "emp-2" });
  });

  it("allows on-behalf when the actor has no linked employee", () => {
    expect(
      resolveLeaveRequestTargetEmployeeId({
        mode: "onBehalf",
        actorEmployeeId: null,
        submittedEmployeeId: "emp-2",
      }),
    ).toEqual({ ok: true, employeeId: "emp-2" });
  });
});
