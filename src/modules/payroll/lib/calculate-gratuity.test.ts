import { describe, expect, it } from "vitest";

import {
  TT_DEFAULT_GRATUITY_TAX_BANDS,
  calculateContractGratuity,
  calculateContractGratuityEstimate,
  calculateGratuityTax,
  inclusiveContractMonths,
} from "@/src/modules/payroll/lib/calculate-gratuity";

describe("inclusiveContractMonths", () => {
  it("counts a full year as 12 months", () => {
    expect(
      inclusiveContractMonths(
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-12-31T00:00:00.000Z"),
      ),
    ).toBe(12);
  });
});

describe("calculateGratuityTax (IRD tiers)", () => {
  it("applies 25% under 1,000,000", () => {
    expect(
      calculateGratuityTax({
        grossGratuity: 38_400,
        taxMode: "TIERED",
        taxBands: TT_DEFAULT_GRATUITY_TAX_BANDS,
      }),
    ).toBe(9_600);
  });

  it("applies 30% above 1,000,000", () => {
    // 1_000_000 @ 25% = 250_000; 200_000 @ 30% = 60_000 → 310_000
    expect(
      calculateGratuityTax({
        grossGratuity: 1_200_000,
        taxMode: "TIERED",
        taxBands: TT_DEFAULT_GRATUITY_TAX_BANDS,
      }),
    ).toBe(310_000);
  });
});

describe("TT MoF example", () => {
  it("matches 16,000 × 12 × 20% with 25% tax", () => {
    const result = calculateContractGratuity({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      baseSalary: 16_000,
      ratePercent: 20,
      policy: {
        formulaKind: "PCT_OF_TERM_EARNINGS",
        defaultRatePercent: 20,
        taxMode: "TIERED",
        taxBands: TT_DEFAULT_GRATUITY_TAX_BANDS,
      },
    });

    expect(result.estimatedGrossEarnings).toBe(192_000);
    expect(result.estimatedGrossGratuity).toBe(38_400);
    expect(result.estimatedTax).toBe(9_600);
    expect(result.estimatedNetGratuity).toBe(28_800);
  });

  it("uses term months for eligible gross, not a fixed calendar year", () => {
    const result = calculateContractGratuity({
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      baseSalary: 16_000,
      allowances: [
        {
          amount: 2_000,
          frequency: "MONTHLY",
          includedInGratuity: true,
        },
      ],
      ratePercent: 20,
      policy: {
        formulaKind: "PCT_OF_TERM_EARNINGS",
        defaultRatePercent: 20,
        taxMode: "TIERED",
        taxBands: TT_DEFAULT_GRATUITY_TAX_BANDS,
      },
    });

    // monthly eligible = 18_000; inclusive months = 24 → 432_000 (not 18_000 × 12)
    expect(result.contractMonths).toBe(24);
    expect(result.monthlyEligibleEarnings).toBe(18_000);
    expect(result.estimatedGrossEarnings).toBe(432_000);
    expect(result.estimatedGrossGratuity).toBe(86_400);
  });
});

describe("calculateContractGratuityEstimate (legacy flat tax)", () => {
  it("still supports flat tax rate callers", () => {
    const result = calculateContractGratuityEstimate({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      baseSalary: 16_000,
      gratuityRate: 20,
      gratuityTaxRate: 25,
    });

    expect(result.estimatedGrossGratuity).toBe(38_400);
    expect(result.estimatedTax).toBe(9_600);
    expect(result.estimatedNetGratuity).toBe(28_800);
  });
});
