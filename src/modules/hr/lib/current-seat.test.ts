import { describe, expect, it } from "vitest";

import {
  assertCurrentSeatMatchesAssignment,
  CurrentSeatMismatchError,
  currentSeatMatchesAssignment,
} from "@/src/modules/hr/lib/current-seat";

describe("currentSeatMatchesAssignment", () => {
  it("matches when employee cache equals current assignment", () => {
    expect(
      currentSeatMatchesAssignment(
        { departmentId: "d1", positionId: "p1" },
        { departmentId: "d1", positionId: "p1" },
      ),
    ).toBe(true);
  });

  it("treats null position on both sides as a match", () => {
    expect(
      currentSeatMatchesAssignment(
        { departmentId: "d1", positionId: null },
        { departmentId: "d1", positionId: null },
      ),
    ).toBe(true);
  });

  it("matches empty cache when there is no current assignment", () => {
    expect(
      currentSeatMatchesAssignment(
        { departmentId: null, positionId: null },
        null,
      ),
    ).toBe(true);
  });

  it("fails when cache has a seat but no current assignment", () => {
    expect(
      currentSeatMatchesAssignment(
        { departmentId: "d1", positionId: null },
        null,
      ),
    ).toBe(false);
  });
});

describe("assertCurrentSeatMatchesAssignment", () => {
  it("throws CurrentSeatMismatchError on disagreement", () => {
    expect(() =>
      assertCurrentSeatMatchesAssignment(
        { departmentId: "d1", positionId: "p1" },
        { departmentId: "d1", positionId: "p2" },
      ),
    ).toThrow(CurrentSeatMismatchError);
  });
});
