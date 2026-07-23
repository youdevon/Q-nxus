import { describe, expect, it } from "vitest";

import {
  TT_DEFAULT_GRATUITY_TAX_BANDS,
  calculateContractGratuity,
} from "@/src/modules/payroll/lib/calculate-gratuity";
import {
  accruedGratuityToDate,
  computeSettlementAmounts,
} from "@/src/modules/payroll/services/gratuity-settlement";

const ttPolicy = {
  formulaKind: "PCT_OF_TERM_EARNINGS" as const,
  defaultRatePercent: 20,
  taxMode: "TIERED" as const,
  taxBands: TT_DEFAULT_GRATUITY_TAX_BANDS,
};

describe("computeSettlementAmounts with actual payroll override", () => {
  it("applies actual eligible gross and reports variance vs contract schedule", () => {
    const result = computeSettlementAmounts(
      {
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        baseSalary: 16_000,
        gratuityEligible: true,
        gratuityRate: 20,
      },
      ttPolicy,
      {
        asOf: new Date("2027-01-15T00:00:00.000Z"),
        actualEligibleGrossEarnings: 200_000,
        actualPayslipCount: 12,
      },
    );

    expect(result.earningsBasis).toBe("ACTUAL_PAYROLL");
    expect(result.estimatedGrossEarnings).toBe(200_000);
    expect(result.estimatedGrossGratuity).toBe(40_000);
    expect(result.contractEstimateGrossEarnings).toBe(192_000);
    expect(result.contractEstimateGrossGratuity).toBe(38_400);
    expect(result.varianceGrossEarnings).toBe(8_000);
    expect(result.varianceGrossGratuity).toBe(1_600);
    expect(result.estimatedTax).toBe(10_000);
    expect(result.estimatedNetGratuity).toBe(30_000);
  });

  it("keeps contract schedule when no actual slips", () => {
    const result = computeSettlementAmounts(
      {
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        baseSalary: 16_000,
        gratuityEligible: true,
        gratuityRate: 20,
      },
      ttPolicy,
      { asOf: new Date("2026-06-01T00:00:00.000Z") },
    );

    expect(result.earningsBasis).toBe("CONTRACT_SCHEDULE");
    expect(result.estimatedGrossGratuity).toBe(38_400);
    expect(result.varianceGrossGratuity).toBe(0);
  });
});

describe("accruedGratuityToDate", () => {
  it("prorates by elapsed months", () => {
    expect(
      accruedGratuityToDate({
        grossObligation: 38_400,
        contractStart: new Date("2026-01-01T00:00:00.000Z"),
        contractEnd: new Date("2026-12-31T00:00:00.000Z"),
        asOf: new Date("2026-06-30T00:00:00.000Z"),
      }),
    ).toBe(19_200);
  });
});

describe("eligibleGrossEarningsOverride", () => {
  it("drives PCT_OF_TERM_EARNINGS from override gross", () => {
    const result = calculateContractGratuity({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      baseSalary: 16_000,
      ratePercent: 20,
      policy: ttPolicy,
      eligibleGrossEarningsOverride: 192_000,
    });
    expect(result.estimatedGrossGratuity).toBe(38_400);
  });
});
