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
    });

    expect(result).toEqual({
      classCode: null,
      employeeWeekly: 0,
      employerWeekly: 0,
      employeeMonthly: 0,
      employerMonthly: 0,
      totalMonthly: 0,
      belowMinimum: true,
    });
  });

  it("computes Class XVI for TTD 30,000/month using 4⅓ weeks", () => {
    const result = computeNisContribution({
      monthlySalary: 30_000,
      classes: TT_NIS_2026_CLASSES,
      weeksPerMonth: NIS_WEEKS_PER_MONTH,
    });

    expect(result.classCode).toBe("XVI");
    expect(result.belowMinimum).toBe(false);
    expect(result.employeeWeekly).toBe(169.5);
    expect(result.employerWeekly).toBe(339);
    expect(result.employeeMonthly).toBe(734.5);
    expect(result.employerMonthly).toBe(1469);
    expect(result.totalMonthly).toBe(2203.5);
  });

  it("computes Class I employee and employer monthly amounts", () => {
    const result = computeNisContribution({
      monthlySalary: 1000,
      classes: TT_NIS_2026_CLASSES,
    });

    expect(result.classCode).toBe("I");
    expect(result.employeeMonthly).toBe(
      Math.round(14.6 * NIS_WEEKS_PER_MONTH * 100) / 100,
    );
    expect(result.employerMonthly).toBe(
      Math.round(29.2 * NIS_WEEKS_PER_MONTH * 100) / 100,
    );
  });
});
