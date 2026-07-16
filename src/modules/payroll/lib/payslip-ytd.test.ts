import { describe, expect, it } from "vitest";

import {
  assemblePayslipYtd,
  emptyPayslipYtd,
  periodKeyFromAsOf,
  yearFromPeriodKey,
} from "./payslip-ytd";

describe("yearFromPeriodKey", () => {
  it("parses a monthly period key", () => {
    expect(yearFromPeriodKey("2026-07")).toBe(2026);
    expect(yearFromPeriodKey("2025-12")).toBe(2025);
  });

  it("rejects invalid keys", () => {
    expect(yearFromPeriodKey("2026")).toBeNull();
    expect(yearFromPeriodKey("2026-13")).toBeNull();
    expect(yearFromPeriodKey(null)).toBeNull();
  });
});

describe("periodKeyFromAsOf", () => {
  it("derives YYYY-MM from an asOf date", () => {
    expect(periodKeyFromAsOf("2026-06-30T12:00:00.000Z")).toBe("2026-06");
  });
});

describe("assemblePayslipYtd", () => {
  it("returns empty totals when there is no history or current slip", () => {
    expect(assemblePayslipYtd({ year: 2026, priorPosted: [] })).toEqual(
      emptyPayslipYtd(2026),
    );
  });

  it("sums prior posted slips only when current is omitted", () => {
    const ytd = assemblePayslipYtd({
      year: 2026,
      priorPosted: [
        { grossPay: 10_000, totalDeductions: 1_000, netPay: 9_000 },
        { grossPay: 10_000, totalDeductions: 1_200, netPay: 8_800 },
      ],
    });

    expect(ytd).toEqual({
      year: 2026,
      periodCount: 2,
      grossPay: 20_000,
      totalDeductions: 2_200,
      netPay: 17_800,
    });
  });

  it("includes the current slip for posted views", () => {
    const ytd = assemblePayslipYtd({
      year: 2026,
      priorPosted: [
        { grossPay: 10_000, totalDeductions: 1_000, netPay: 9_000 },
      ],
      current: { grossPay: 10_500, totalDeductions: 1_100, netPay: 9_400 },
    });

    expect(ytd.periodCount).toBe(2);
    expect(ytd.grossPay).toBe(20_500);
    expect(ytd.totalDeductions).toBe(2_100);
    expect(ytd.netPay).toBe(18_400);
  });

  it("includes the live preview as the current contribution", () => {
    const ytd = assemblePayslipYtd({
      year: 2026,
      priorPosted: [
        { grossPay: 8_000.55, totalDeductions: 500.25, netPay: 7_500.3 },
      ],
      current: {
        grossPay: 8_000.55,
        totalDeductions: 500.25,
        netPay: 7_500.3,
      },
    });

    expect(ytd.periodCount).toBe(2);
    expect(ytd.grossPay).toBe(16_001.1);
    expect(ytd.totalDeductions).toBe(1_000.5);
    expect(ytd.netPay).toBe(15_000.6);
  });

  it("rounds money to two decimal places", () => {
    const ytd = assemblePayslipYtd({
      year: 2026,
      priorPosted: [{ grossPay: 0.1, totalDeductions: 0.2, netPay: 0.3 }],
      current: { grossPay: 0.2, totalDeductions: 0.1, netPay: 0.1 },
    });

    expect(ytd.grossPay).toBe(0.3);
    expect(ytd.totalDeductions).toBe(0.3);
    expect(ytd.netPay).toBe(0.4);
  });
});
