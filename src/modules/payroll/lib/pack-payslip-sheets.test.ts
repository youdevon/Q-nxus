import { describe, expect, it } from "vitest";

import {
  estimatePayslipPrintUnits,
  packPayslipPrintUnits,
  summarizePayslipPacking,
} from "@/src/modules/payroll/lib/pack-payslip-sheets";

describe("estimatePayslipPrintUnits", () => {
  it("keeps a typical statutory slip under one-third of a Letter sheet", () => {
    const units = estimatePayslipPrintUnits({
      extraEarningLines: 0,
      deductionLines: 3,
      hasYtd: false,
    });
    expect(units).toBeLessThanOrEqual(34);
    expect(units * 3).toBeLessThanOrEqual(100);
  });

  it("makes YTD slips prefer two-per-page", () => {
    const units = estimatePayslipPrintUnits({
      extraEarningLines: 0,
      deductionLines: 3,
      hasYtd: true,
    });
    expect(units * 3).toBeGreaterThan(100);
    expect(units * 2).toBeLessThanOrEqual(100);
  });
});

describe("packPayslipPrintUnits", () => {
  it("packs three typical slips on one sheet", () => {
    const typical = estimatePayslipPrintUnits({
      extraEarningLines: 0,
      deductionLines: 3,
      hasYtd: false,
    });
    expect(
      packPayslipPrintUnits([typical, typical, typical]),
    ).toEqual([[0, 1, 2]]);
  });

  it("packs YTD slips two-per-sheet", () => {
    const withYtd = estimatePayslipPrintUnits({
      extraEarningLines: 0,
      deductionLines: 3,
      hasYtd: true,
    });
    expect(packPayslipPrintUnits([withYtd, withYtd, withYtd])).toEqual([
      [0, 1],
      [2],
    ]);
  });

  it("never exceeds three per sheet even when units are tiny", () => {
    expect(packPayslipPrintUnits([10, 10, 10, 10])).toEqual([[0, 1, 2], [3]]);
  });

  it("isolates a slip that alone nearly fills the sheet", () => {
    expect(packPayslipPrintUnits([90, 30, 30])).toEqual([[0], [1, 2]]);
  });

  it("summarizes packing for the toolbar", () => {
    expect(summarizePayslipPacking([[0, 1, 2], [3, 4]])).toEqual({
      sheetCount: 2,
      maxOnSheet: 3,
      packingLabel: "3+2",
    });
  });
});
