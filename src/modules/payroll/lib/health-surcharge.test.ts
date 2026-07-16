import { describe, expect, it } from "vitest";

import {
  ageInFullYears,
  computeHealthSurcharge,
  TT_HEALTH_SURCHARGE_2026,
} from "./health-surcharge";

describe("ageInFullYears", () => {
  it("computes age relative to as-of date", () => {
    expect(
      ageInFullYears("2000-06-15", new Date("2026-06-14T00:00:00.000Z")),
    ).toBe(25);
    expect(
      ageInFullYears("2000-06-15", new Date("2026-06-15T00:00:00.000Z")),
    ).toBe(26);
  });
});

describe("computeHealthSurcharge", () => {
  it("uses higher tier for TTD 30,000/month → 8.25/week, avg monthly 35.75", () => {
    const result = computeHealthSurcharge({
      config: TT_HEALTH_SURCHARGE_2026,
      monthlyEarnings: 30_000,
    });

    expect(result.tier).toBe("HIGHER");
    expect(result.weeklyAmount).toBe(8.25);
    expect(result.annualAmount).toBe(429);
    expect(result.averageMonthlyAmount).toBe(35.75);
    expect(result.periodAmount).toBe(8.25);
    expect(
      computeHealthSurcharge({
        config: TT_HEALTH_SURCHARGE_2026,
        monthlyEarnings: 30_000,
        weeksInPeriod: 4,
      }).periodAmount,
    ).toBe(33);
    expect(
      computeHealthSurcharge({
        config: TT_HEALTH_SURCHARGE_2026,
        monthlyEarnings: 30_000,
        weeksInPeriod: 5,
      }).periodAmount,
    ).toBe(41.25);
  });

  it("uses lower tier at or below monthly threshold", () => {
    const atThreshold = computeHealthSurcharge({
      config: TT_HEALTH_SURCHARGE_2026,
      monthlyEarnings: 469.99,
    });
    expect(atThreshold.tier).toBe("LOWER");
    expect(atThreshold.weeklyAmount).toBe(4.8);

    const lowWeekly = computeHealthSurcharge({
      config: TT_HEALTH_SURCHARGE_2026,
      weeklyEarnings: 109,
    });
    expect(lowWeekly.tier).toBe("LOWER");
    expect(lowWeekly.weeklyAmount).toBe(4.8);
  });

  it("exempts under 16 and age 60+", () => {
    expect(
      computeHealthSurcharge({
        config: TT_HEALTH_SURCHARGE_2026,
        monthlyEarnings: 30_000,
        ageYears: 15,
      }).exemptionReason,
    ).toBe("UNDER_AGE");

    expect(
      computeHealthSurcharge({
        config: TT_HEALTH_SURCHARGE_2026,
        monthlyEarnings: 30_000,
        ageYears: 60,
      }).exemptionReason,
    ).toBe("SENIOR");
  });

  it("exempts pension-only income", () => {
    expect(
      computeHealthSurcharge({
        config: TT_HEALTH_SURCHARGE_2026,
        monthlyEarnings: 30_000,
        pensionOnlyIncome: true,
      }).exemptionReason,
    ).toBe("PENSION_ONLY");
  });
});
