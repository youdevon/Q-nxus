import { describe, expect, it } from "vitest";

import {
  computeNisContribution,
  NIS_WEEKS_PER_MONTH,
  resolveNisClass,
} from "./nis-contribution";
import { TT_NIS_2026_CLASSES } from "./nis-seed-data";

describe("resolveNisClass", () => {
  it("returns null below the Class I floor", () => {
    expect(resolveNisClass(866.99, TT_NIS_2026_CLASSES)).toBeNull();
    expect(resolveNisClass(0, TT_NIS_2026_CLASSES)).toBeNull();
  });

  it("resolves Class I at the minimum band", () => {
    const result = resolveNisClass(867, TT_NIS_2026_CLASSES);
    expect(result?.classCode).toBe("I");
  });

  it("resolves mid-band classes", () => {
    expect(resolveNisClass(1500, TT_NIS_2026_CLASSES)?.classCode).toBe("II");
    expect(resolveNisClass(5000, TT_NIS_2026_CLASSES)?.classCode).toBe("VII");
  });

  it("caps at Class XVI for high earners", () => {
    expect(resolveNisClass(30_000, TT_NIS_2026_CLASSES)?.classCode).toBe("XVI");
    expect(resolveNisClass(13600, TT_NIS_2026_CLASSES)?.classCode).toBe("XVI");
  });
});

describe("computeNisContribution", () => {
  it("returns zero contribution below Class I", () => {
    const result = computeNisContribution({
      monthlySalary: 500,
      classes: TT_NIS_2026_CLASSES,
      weeksInPeriod: 4,
    });

    expect(result).toEqual({
      classCode: null,
      employeeWeekly: 0,
      employerWeekly: 0,
      employeeMonthly: 0,
      employerMonthly: 0,
      totalMonthly: 0,
      weeksInPeriod: 4,
      belowMinimum: true,
    });
  });

  it("computes Class XVI for TTD 30,000/month using 4 Mondays", () => {
    const result = computeNisContribution({
      monthlySalary: 30_000,
      classes: TT_NIS_2026_CLASSES,
      weeksInPeriod: 4,
    });

    expect(result.classCode).toBe("XVI");
    expect(result.belowMinimum).toBe(false);
    expect(result.weeksInPeriod).toBe(4);
    expect(result.employeeWeekly).toBe(169.5);
    expect(result.employerWeekly).toBe(339);
    expect(result.employeeMonthly).toBe(678);
    expect(result.employerMonthly).toBe(1_356);
    expect(result.totalMonthly).toBe(2_034);
  });

  it("computes Class XVI for TTD 30,000/month using 5 Mondays", () => {
    const result = computeNisContribution({
      monthlySalary: 30_000,
      classes: TT_NIS_2026_CLASSES,
      weeksInPeriod: 5,
    });

    expect(result.employeeMonthly).toBe(847.5);
    expect(result.employerMonthly).toBe(1_695);
    expect(result.totalMonthly).toBe(2_542.5);
    expect(result.weeksInPeriod).toBe(5);
  });

  it("computes Class I employee and employer amounts for 4 weeks", () => {
    const result = computeNisContribution({
      monthlySalary: 1000,
      classes: TT_NIS_2026_CLASSES,
      weeksInPeriod: 4,
    });

    expect(result.classCode).toBe("I");
    expect(result.employeeMonthly).toBe(
      Math.round(14.6 * 4 * 100) / 100,
    );
    expect(result.employerMonthly).toBe(
      Math.round(29.2 * 4 * 100) / 100,
    );
  });

  it("falls back to legacy 13/3 average when weeks omitted", () => {
    const result = computeNisContribution({
      monthlySalary: 30_000,
      classes: TT_NIS_2026_CLASSES,
    });

    expect(result.employeeMonthly).toBe(
      Math.round(169.5 * NIS_WEEKS_PER_MONTH * 100) / 100,
    );
  });
});
