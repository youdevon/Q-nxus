import { describe, expect, it } from "vitest";

import {
  countMondaysInMonth,
  countMondaysInRange,
} from "./contribution-weeks";

describe("countMondaysInRange / countMondaysInMonth", () => {
  it("July 2026 has 4 Mondays", () => {
    expect(countMondaysInMonth(2026, 7)).toBe(4);
    expect(
      countMondaysInRange(
        new Date("2026-07-01T12:00:00.000Z"),
        new Date("2026-07-31T12:00:00.000Z"),
      ),
    ).toBe(4);
  });

  it("August 2026 has 5 Mondays (month ends on Monday)", () => {
    expect(countMondaysInMonth(2026, 8)).toBe(5);
    expect(
      countMondaysInRange(
        new Date("2026-08-01T12:00:00.000Z"),
        new Date("2026-08-31T12:00:00.000Z"),
      ),
    ).toBe(5);
  });

  it("counts when the month starts on Monday", () => {
    // June 2026 starts Monday 1 June → 1, 8, 15, 22, 29
    expect(countMondaysInMonth(2026, 6)).toBe(5);
  });

  it("returns 0 for inverted ranges", () => {
    expect(
      countMondaysInRange(
        new Date("2026-08-31T12:00:00.000Z"),
        new Date("2026-08-01T12:00:00.000Z"),
      ),
    ).toBe(0);
  });

  it("counts a single Monday-only period", () => {
    expect(
      countMondaysInRange(
        new Date("2026-08-31T12:00:00.000Z"),
        new Date("2026-08-31T12:00:00.000Z"),
      ),
    ).toBe(1);
  });
});
