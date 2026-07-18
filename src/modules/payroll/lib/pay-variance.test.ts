import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAY_VARIANCE_THRESHOLDS,
  evaluateNetPayVariance,
} from "@/src/modules/payroll/lib/pay-variance";

describe("evaluateNetPayVariance", () => {
  it("flags absolute threshold breaches", () => {
    const flag = evaluateNetPayVariance({
      employeeId: "e1",
      employeeName: "Ada",
      priorNet: 5000,
      currentNet: 5600,
      thresholds: DEFAULT_PAY_VARIANCE_THRESHOLDS,
    });
    expect(flag.requiresExplanation).toBe(true);
    expect(flag.reason).toBe("ABSOLUTE");
    expect(flag.deltaNet).toBe(600);
  });

  it("flags relative threshold breaches under absolute", () => {
    const flag = evaluateNetPayVariance({
      employeeId: "e1",
      employeeName: "Ada",
      priorNet: 2000,
      currentNet: 2300,
      thresholds: { netAbsolute: 1000, netRelative: 0.1 },
    });
    expect(flag.requiresExplanation).toBe(true);
    expect(flag.reason).toBe("RELATIVE");
  });

  it("does not flag small changes", () => {
    const flag = evaluateNetPayVariance({
      employeeId: "e1",
      employeeName: "Ada",
      priorNet: 5000,
      currentNet: 5050,
    });
    expect(flag.requiresExplanation).toBe(false);
  });
});
