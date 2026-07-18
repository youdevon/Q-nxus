import { describe, expect, it } from "vitest";

import {
  addCents,
  fromCents,
  moneyDiffCents,
  mulCentsRate,
  roundToCents,
  subCents,
  sumMoney,
  toCents,
} from "@/src/modules/payroll/lib/money";

describe("payroll money (cents)", () => {
  it("rounds to nearest cent via Math.round (IEEE float aware)", () => {
    // Prefer constructing from whole cents when possible; float midpoints are unreliable.
    expect(roundToCents(1.004)).toBe(1);
    expect(roundToCents(1.006)).toBe(1.01);
    expect(roundToCents(5496.455)).toBe(5496.46);
    expect(fromCents(toCents(10.115))).toBe(10.12);
  });

  it("converts to/from cents", () => {
    expect(toCents(10.5)).toBe(1050);
    expect(fromCents(1050)).toBe(10.5);
    expect(toCents(Number.NaN)).toBe(0);
    expect(fromCents(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("sums via cents without float drift", () => {
    expect(sumMoney(0.1, 0.2)).toBe(0.3);
    expect(sumMoney(10.11, 20.22, 30.33)).toBe(60.66);
  });

  it("add/sub cents", () => {
    expect(fromCents(addCents(1011, 2022))).toBe(30.33);
    expect(fromCents(subCents(3033, 1011))).toBe(20.22);
  });

  it("multiplies cents by rate once", () => {
    // 1000.00 * 25% = 250.00
    expect(fromCents(mulCentsRate(toCents(1000), 0.25))).toBe(250);
  });

  it("detects cent mismatch on run totals", () => {
    expect(moneyDiffCents(100.01, 100.01)).toBe(0);
    expect(moneyDiffCents(100.01, 100)).toBe(1);
  });
});
