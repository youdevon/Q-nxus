import { describe, expect, it } from "vitest";

import {
  applyLeaveApprove,
  applyLeaveCancelTaken,
  applyLeaveRelease,
  applyLeaveReserve,
  isLeavePeriodStarted,
  splitLeaveTakenForDisplay,
} from "@/src/modules/hr/lib/leave-balance-math";

const starting = {
  reserved: "0",
  taken: "2",
  availableBalance: "10",
};

describe("leave reserve / approve / withdraw math", () => {
  it("reserves from available into reserved", () => {
    expect(applyLeaveReserve(starting, "3")).toEqual({
      reserved: "3",
      taken: "2",
      availableBalance: "7",
    });
  });

  it("rejects reserve when available is insufficient", () => {
    expect(() => applyLeaveReserve(starting, "11")).toThrow(
      /Insufficient available/,
    );
  });

  it("approves by moving reserved into taken", () => {
    const reserved = applyLeaveReserve(starting, "3");

    expect(applyLeaveApprove(reserved, "3")).toEqual({
      reserved: "0",
      taken: "5",
      availableBalance: "7",
    });
  });

  it("releases reserved back to available on withdraw/reject", () => {
    const reserved = applyLeaveReserve(starting, "3");

    expect(applyLeaveRelease(reserved, "3")).toEqual({
      reserved: "0",
      taken: "2",
      availableBalance: "10",
    });
  });

  it("cancels approved leave by reversing taken", () => {
    const reserved = applyLeaveReserve(starting, "3");
    const approved = applyLeaveApprove(reserved, "3");

    expect(applyLeaveCancelTaken(approved, "3")).toEqual({
      reserved: "0",
      taken: "2",
      availableBalance: "10",
    });
  });

  it("rejects approve/release when reserved is too low", () => {
    expect(() => applyLeaveApprove(starting, "1")).toThrow(
      /Insufficient reserved/,
    );
    expect(() => applyLeaveRelease(starting, "1")).toThrow(
      /Insufficient reserved/,
    );
  });
});

describe("profile leave taken vs approved display", () => {
  it("peels future approved days out of stored taken", () => {
    expect(splitLeaveTakenForDisplay("5", "3")).toEqual({
      approved: "3",
      taken: "2",
    });
  });

  it("caps approved at stored taken", () => {
    expect(splitLeaveTakenForDisplay("2", "5")).toEqual({
      approved: "2",
      taken: "0",
    });
  });

  it("treats leave as started on the start date", () => {
    const asOf = new Date("2026-07-16T15:00:00.000Z");

    expect(
      isLeavePeriodStarted(new Date("2026-07-16T00:00:00.000Z"), asOf),
    ).toBe(true);
    expect(
      isLeavePeriodStarted(new Date("2026-07-17T00:00:00.000Z"), asOf),
    ).toBe(false);
  });
});
