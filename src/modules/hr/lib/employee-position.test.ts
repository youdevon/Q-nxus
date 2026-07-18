import { describe, expect, it } from "vitest";

import { resolveEmployeePositionTitle } from "@/src/modules/hr/lib/employee-position";

describe("resolveEmployeePositionTitle", () => {
  it("prefers current assignment position over employee position", () => {
    expect(
      resolveEmployeePositionTitle({
        assignmentPositionTitle: "Acting Manager",
        positionTitle: "Analyst",
        contractJobTitle: "Clerk",
      }),
    ).toBe("Acting Manager");
  });

  it("falls back to employee position when assignment has none", () => {
    expect(
      resolveEmployeePositionTitle({
        assignmentPositionTitle: null,
        positionTitle: "Analyst",
        contractJobTitle: "Clerk",
      }),
    ).toBe("Analyst");
  });

  it("uses contract snapshot only when no live position exists", () => {
    expect(
      resolveEmployeePositionTitle({
        positionTitle: null,
        contractJobTitle: "Clerk",
      }),
    ).toBe("Clerk");
  });

  it("trims whitespace and treats blanks as missing", () => {
    expect(
      resolveEmployeePositionTitle({
        positionTitle: "  ",
        contractJobTitle: "  Clerk  ",
      }),
    ).toBe("Clerk");
  });

  it("prefers employee position over blank assignment title", () => {
    expect(
      resolveEmployeePositionTitle({
        assignmentPositionTitle: "   ",
        positionTitle: "Analyst",
        contractJobTitle: "Clerk",
      }),
    ).toBe("Analyst");
  });

  it("returns null when nothing is set", () => {
    expect(resolveEmployeePositionTitle({})).toBeNull();
  });
});
