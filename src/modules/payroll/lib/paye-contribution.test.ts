import { describe, expect, it } from "vitest";

import {
  computePayeContribution,
  computeTaxOnChargeableIncome,
  TT_PAYE_2026_CONFIG,
} from "./paye-contribution";

describe("computeTaxOnChargeableIncome", () => {
  it("applies 25% up to 1M and 30% above", () => {
    expect(
      computeTaxOnChargeableIncome(270_000, TT_PAYE_2026_CONFIG.brackets),
    ).toBe(67_500);
    expect(
      computeTaxOnChargeableIncome(1_200_000, TT_PAYE_2026_CONFIG.brackets),
    ).toBe(310_000);
  });
});

describe("computePayeContribution", () => {
  it("computes monthly PAYE 5,625 for TTD 30,000 with personal allowance only", () => {
    const result = computePayeContribution({
      monthlyTaxableEarnings: 30_000,
      config: TT_PAYE_2026_CONFIG,
      employeeNisWeekly: 0,
    });

    expect(result.annualTaxableIncome).toBe(360_000);
    expect(result.chargeableIncome).toBe(270_000);
    expect(result.annualTax).toBe(67_500);
    expect(result.monthlyPaye).toBe(5_625);
  });

  it("deducts 70% of Class XVI employee NIS for TTD 30,000 example", () => {
    const result = computePayeContribution({
      monthlyTaxableEarnings: 30_000,
      config: TT_PAYE_2026_CONFIG,
      employeeNisWeekly: 169.5,
    });

    expect(result.employeeNisAnnual).toBe(8_814);
    expect(result.nisDeductible).toBe(6_169.8);
    expect(result.chargeableIncome).toBe(263_830.2);
    expect(result.annualTax).toBe(65_957.55);
    expect(result.monthlyPaye).toBe(5_496.46);
  });

  it("caps pension + NIS deductible portion at 60,000", () => {
    const result = computePayeContribution({
      monthlyTaxableEarnings: 30_000,
      config: TT_PAYE_2026_CONFIG,
      employeeNisWeekly: 169.5,
      otherApprovedDeductionsAnnual: 55_000,
    });

    // NIS deductible 6,169.80 + 55,000 = 61,169.80 → capped at 60,000
    expect(result.approvedDeductionsApplied).toBe(60_000);
    expect(result.chargeableIncome).toBe(210_000);
  });
});
