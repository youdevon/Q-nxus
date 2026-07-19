import { describe, expect, it } from "vitest";

import { ageFromDateOfBirth } from "@/src/lib/age";

describe("ageFromDateOfBirth", () => {
  it("returns the age when the birthday has already happened this year", () => {
    expect(
      ageFromDateOfBirth("1994-01-15", new Date("2026-07-17T12:00:00.000Z")),
    ).toBe(32);
  });

  it("subtracts one when the birthday has not happened yet this year", () => {
    expect(
      ageFromDateOfBirth("1994-12-15", new Date("2026-07-17T12:00:00.000Z")),
    ).toBe(31);
  });

  it("uses UTC date parts for Date inputs", () => {
    expect(
      ageFromDateOfBirth(
        new Date("1994-07-17T23:30:00.000Z"),
        new Date("2026-07-17T00:30:00.000Z"),
      ),
    ).toBe(32);
  });

  it("treats Feb 29 birthdays as not reached on Feb 28 in non-leap years", () => {
    expect(
      ageFromDateOfBirth("2000-02-29", new Date("2025-02-28T12:00:00.000Z")),
    ).toBe(24);
    expect(
      ageFromDateOfBirth("2000-02-29", new Date("2025-03-01T12:00:00.000Z")),
    ).toBe(25);
  });

  it("returns null for invalid or future dates", () => {
    expect(ageFromDateOfBirth("2026-02-30")).toBeNull();
    expect(
      ageFromDateOfBirth("2027-01-01", new Date("2026-07-17T12:00:00.000Z")),
    ).toBeNull();
  });
});
