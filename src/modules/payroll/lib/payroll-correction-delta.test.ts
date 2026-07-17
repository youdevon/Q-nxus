import { describe, expect, it } from "vitest";

import {
  computePayslipDelta,
  formatSignedMoney,
  netDeltaDirection,
} from "@/src/modules/payroll/lib/payroll-correction-delta";

describe("computePayslipDelta", () => {
  it("returns correction minus original for each total", () => {
    const delta = computePayslipDelta(
      { grossPay: 12000, totalDeductions: 3200, netPay: 8800 },
      { grossPay: 10000, totalDeductions: 3000, netPay: 7000 },
    );

    expect(delta).toEqual({
      grossPay: 2000,
      totalDeductions: 200,
      netPay: 1800,
    });
  });

  it("handles negative corrections (clawback)", () => {
    const delta = computePayslipDelta(
      { grossPay: 9000, totalDeductions: 2800, netPay: 6200 },
      { grossPay: 10000, totalDeductions: 3000, netPay: 7000 },
    );

    expect(delta?.grossPay).toBe(-1000);
    expect(delta?.netPay).toBe(-800);
  });

  it("rounds to cents to avoid float drift", () => {
    const delta = computePayslipDelta(
      { grossPay: 100.1, totalDeductions: 0, netPay: 100.1 },
      { grossPay: 100.0, totalDeductions: 0, netPay: 100.0 },
    );

    expect(delta?.grossPay).toBeCloseTo(0.1, 5);
    expect(delta?.netPay).toBe(0.1);
  });

  it("returns null when there is no original to compare", () => {
    expect(
      computePayslipDelta(
        { grossPay: 5000, totalDeductions: 1000, netPay: 4000 },
        null,
      ),
    ).toBeNull();
  });
});

describe("netDeltaDirection", () => {
  it("classifies increases, decreases, and no change", () => {
    expect(
      netDeltaDirection({ grossPay: 0, totalDeductions: 0, netPay: 10 }),
    ).toBe("increase");
    expect(
      netDeltaDirection({ grossPay: 0, totalDeductions: 0, netPay: -10 }),
    ).toBe("decrease");
    expect(
      netDeltaDirection({ grossPay: 0, totalDeductions: 0, netPay: 0 }),
    ).toBe("none");
    expect(netDeltaDirection(null)).toBe("none");
  });
});

describe("formatSignedMoney", () => {
  it("prefixes a sign and never renders negative zero", () => {
    expect(formatSignedMoney(1234.5, { currency: "TTD" })).toBe("+TTD 1,234.50");
    expect(formatSignedMoney(-1234.5)).toBe("-1,234.50");
    expect(formatSignedMoney(0, { currency: "TTD" })).toBe("TTD 0.00");
    expect(formatSignedMoney(-0)).toBe("0.00");
  });
});
