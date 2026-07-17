import { describe, expect, it } from "vitest";

import {
  calculateCalendarOverlapDays,
  calculateCalendarProration,
  prorateMoney,
} from "./payroll-period-adjustments";

const periodStart = new Date("2026-07-01T12:00:00.000Z");
const periodEnd = new Date("2026-07-31T12:00:00.000Z");

describe("calculateCalendarProration", () => {
  it("pro-rates a joiner hired mid-month by calendar days worked", () => {
    const result = calculateCalendarProration({
      periodStart,
      periodEnd,
      employeeHireDate: "2026-07-16",
      contractStartDate: "2026-07-16",
    });

    expect(result.periodDays).toBe(31);
    expect(result.workedDays).toBe(16);
    expect(result.factor).toBe(0.5161);
    expect(prorateMoney(31_000, result.factor)).toBe(15_999.1);
  });

  it("pro-rates a leaver terminated mid-month by calendar days worked", () => {
    const result = calculateCalendarProration({
      periodStart,
      periodEnd,
      employeeTerminationDate: "2026-07-10",
    });

    expect(result.periodDays).toBe(31);
    expect(result.workedDays).toBe(10);
    expect(result.factor).toBe(0.3226);
    expect(prorateMoney(31_000, result.factor)).toBe(10_000.6);
  });
});

describe("calculateCalendarOverlapDays", () => {
  it("counts only unpaid leave days overlapping the period", () => {
    expect(
      calculateCalendarOverlapDays({
        periodStart,
        periodEnd,
        startDate: "2026-06-29",
        endDate: "2026-07-03",
      }),
    ).toBe(3);
  });
});
