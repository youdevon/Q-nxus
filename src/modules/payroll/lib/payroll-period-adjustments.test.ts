import { describe, expect, it } from "vitest";

import {
  calculateCalendarOverlapDays,
  calculateCalendarProration,
  prorateMoney,
  resolveContractPaySegments,
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

describe("resolveContractPaySegments", () => {
  it("uses only the current contract when it covers the full period", () => {
    const result = resolveContractPaySegments({
      periodStart,
      periodEnd,
      employeeHireDate: "2026-06-02",
      contracts: [
        {
          id: "old",
          isCurrent: false,
          status: "SUPERSEDED",
          startDate: "2026-07-16",
          endDate: "2027-07-15",
          baseSalary: 30_000,
          jobTitle: "General Manager",
          currency: "TTD",
          allowances: [],
        },
        {
          id: "current",
          isCurrent: true,
          status: "ACTIVE",
          startDate: "2026-07-01",
          endDate: "2027-06-30",
          baseSalary: 30_000,
          jobTitle: "General Manager",
          currency: "TTD",
          allowances: [],
        },
      ],
    });

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.contractId).toBe("current");
    expect(result.segments[0]?.days).toBe(31);
    expect(result.segments[0]?.factor).toBe(1);
    expect(prorateMoney(30_000, result.segments[0]!.factor)).toBe(30_000);
  });

  it("does not use an overlapping superseded contract that starts on/after the current start", () => {
    const result = resolveContractPaySegments({
      periodStart,
      periodEnd,
      employeeHireDate: "2026-06-02",
      contracts: [
        {
          id: "old-overlap",
          isCurrent: false,
          status: "SUPERSEDED",
          startDate: "2026-07-16",
          endDate: "2027-01-15",
          baseSalary: 18_000,
          jobTitle: "General Manager",
          currency: "TTD",
          allowances: [],
        },
        {
          id: "current",
          isCurrent: true,
          status: "ACTIVE",
          startDate: "2026-07-16",
          endDate: "2027-07-15",
          baseSalary: 30_000,
          jobTitle: "General Manager",
          currency: "TTD",
          allowances: [],
        },
      ],
    });

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.contractId).toBe("current");
    expect(result.segments[0]?.days).toBe(16);
    expect(result.segments[0]?.baseSalary).toBe(30_000);
    expect(prorateMoney(30_000, result.segments[0]!.factor)).toBe(15_483);
  });

  it("pays the prior superseded rate for days before a mid-month amendment", () => {
    const result = resolveContractPaySegments({
      periodStart,
      periodEnd,
      employeeHireDate: "2026-01-01",
      contracts: [
        {
          id: "prior",
          isCurrent: false,
          status: "SUPERSEDED",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          baseSalary: 20_000,
          jobTitle: "Manager",
          currency: "TTD",
          allowances: [],
        },
        {
          id: "current",
          isCurrent: true,
          status: "ACTIVE",
          startDate: "2026-07-16",
          endDate: "2026-12-31",
          baseSalary: 30_000,
          jobTitle: "Manager",
          currency: "TTD",
          allowances: [],
        },
      ],
    });

    expect(result.segments).toHaveLength(2);
    expect(result.segments.map((segment) => segment.contractId)).toEqual([
      "prior",
      "current",
    ]);
    expect(result.segments[0]?.days).toBe(15);
    expect(result.segments[1]?.days).toBe(16);
    expect(prorateMoney(20_000, result.segments[0]!.factor)).toBe(9_678);
    expect(prorateMoney(30_000, result.segments[1]!.factor)).toBe(15_483);
  });
});
