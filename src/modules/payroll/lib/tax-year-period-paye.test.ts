import { describe, expect, it } from "vitest";

import type { PayeTaxConfigInput } from "./paye-contribution";
import {
  computeTaxYearPeriodPaye,
  shouldUseTaxYearPeriodPaye,
} from "./tax-year-period-paye";

const CONFIG_2026: PayeTaxConfigInput = {
  personalAllowanceAnnual: 90_000,
  nisDeductiblePortion: 0.7,
  approvedDeductionCapAnnual: 60_000,
  brackets: [
    { upToAmount: 1_000_000, ratePercent: 25, sortOrder: 1 },
    { upToAmount: null, ratePercent: 30, sortOrder: 2 },
  ],
};

describe("shouldUseTaxYearPeriodPaye", () => {
  it("uses tax-year projection for mid-year hire even on non-cumulative", () => {
    expect(
      shouldUseTaxYearPeriodPaye({
        taxCalculationMethod: "STANDARD_NON_CUMULATIVE",
        employmentStartDate: new Date("2026-08-01T00:00:00.000Z"),
        taxYear: 2026,
      }),
    ).toBe(true);
  });

  it("allows simple monthly path for Jan 1 starter on non-cumulative", () => {
    expect(
      shouldUseTaxYearPeriodPaye({
        taxCalculationMethod: "STANDARD_NON_CUMULATIVE",
        employmentStartDate: new Date("2026-01-01T00:00:00.000Z"),
        taxYear: 2026,
      }),
    ).toBe(false);
  });
});

describe("computeTaxYearPeriodPaye", () => {
  it("Scenario 3 — August joiner, no prior: does not annualize ×12", () => {
    const result = computeTaxYearPeriodPaye({
      taxYear: 2026,
      periodStart: new Date("2026-08-01T12:00:00.000Z"),
      periodEnd: new Date("2026-08-31T12:00:00.000Z"),
      employmentStartDate: new Date("2026-08-01T00:00:00.000Z"),
      config: CONFIG_2026,
      periodTaxableEarnings: 12_000,
      currentEmployerTaxableYtdBefore: 0,
      currentEmployerPayePaidYtdBefore: 0,
      previousEmploymentStatus: "NO_PREVIOUS_EMPLOYMENT",
      recognizePriorEmployment: false,
      periodNisEmployee: 0,
      employeeNisWeekly: 0,
    });

    // Aug–Dec = 5 periods at 12,000 → 60,000 < 90,000 allowance → PAYE 0
    expect(result.periodsInEmploymentYear).toBe(5);
    expect(result.remainingPeriodsIncludingThis).toBe(5);
    expect(result.projectedAnnualTaxable).toBe(60_000);
    expect(result.periodPaye).toBe(0);
    expect(result.annualTax).toBe(0);
  });

  it("Scenario 3 — December joiner: one month only", () => {
    const result = computeTaxYearPeriodPaye({
      taxYear: 2026,
      periodStart: new Date("2026-12-01T12:00:00.000Z"),
      periodEnd: new Date("2026-12-31T12:00:00.000Z"),
      employmentStartDate: new Date("2026-12-01T00:00:00.000Z"),
      config: CONFIG_2026,
      periodTaxableEarnings: 12_000,
      currentEmployerTaxableYtdBefore: 0,
      currentEmployerPayePaidYtdBefore: 0,
      previousEmploymentStatus: "NO_PREVIOUS_EMPLOYMENT",
      recognizePriorEmployment: false,
    });

    expect(result.projectedAnnualTaxable).toBe(12_000);
    expect(result.periodPaye).toBe(0);
  });

  it("Scenario 2 — mid-year with prior: recognizes prior PAYE credit", () => {
    const result = computeTaxYearPeriodPaye({
      taxYear: 2026,
      periodStart: new Date("2026-08-01T12:00:00.000Z"),
      periodEnd: new Date("2026-08-31T12:00:00.000Z"),
      employmentStartDate: new Date("2026-08-01T00:00:00.000Z"),
      config: CONFIG_2026,
      periodTaxableEarnings: 16_500,
      currentEmployerTaxableYtdBefore: 0,
      currentEmployerPayePaidYtdBefore: 0,
      priorTaxableYtd: 89_268,
      priorPayePaidYtd: 11_517,
      previousEmploymentStatus: "PREVIOUS_EMPLOYMENT",
      recognizePriorEmployment: true,
      periodNisEmployee: 847.5,
      nisEmployeePaidYtdBefore: 4_407,
    });

    expect(result.explain.recognizedPriorPaye).toBe(11_517);
    expect(result.periodPaye).toBeGreaterThanOrEqual(0);
    // Heavy prior PAYE vs projected liability → often zero this month
    expect(result.payePaidYtdBefore).toBe(11_517);
  });

  it("UNKNOWN prior status never silently assumes zero — flags review", () => {
    const result = computeTaxYearPeriodPaye({
      taxYear: 2026,
      periodStart: new Date("2026-08-01T12:00:00.000Z"),
      periodEnd: new Date("2026-08-31T12:00:00.000Z"),
      employmentStartDate: new Date("2026-08-01T00:00:00.000Z"),
      config: CONFIG_2026,
      periodTaxableEarnings: 20_000,
      currentEmployerTaxableYtdBefore: 0,
      currentEmployerPayePaidYtdBefore: 0,
      previousEmploymentStatus: "UNKNOWN_PREVIOUS_INCOME",
      recognizePriorEmployment: false,
    });

    expect(result.payePositionStatus).toBe("PRIOR_EMPLOYMENT_DATA_REQUIRED");
    expect(result.warnings.some((w) => /Unknown/i.test(w))).toBe(true);
  });

  it("over-deduction clamps to zero and sets POSSIBLE_OVERDEDUCTION", () => {
    const result = computeTaxYearPeriodPaye({
      taxYear: 2026,
      periodStart: new Date("2026-08-01T12:00:00.000Z"),
      periodEnd: new Date("2026-08-31T12:00:00.000Z"),
      employmentStartDate: new Date("2026-01-01T00:00:00.000Z"),
      config: CONFIG_2026,
      periodTaxableEarnings: 10_000,
      currentEmployerTaxableYtdBefore: 70_000,
      currentEmployerPayePaidYtdBefore: 50_000,
      previousEmploymentStatus: "NO_PREVIOUS_EMPLOYMENT",
      recognizePriorEmployment: false,
    });

    expect(result.periodPaye).toBe(0);
    expect(result.payePositionStatus).toBe("POSSIBLE_OVERDEDUCTION");
    expect(result.projectedOverDeduction).toBeGreaterThan(0);
  });

  it("salary increase uses YTD actual + future at new rate (not new×12)", () => {
    // Jan–Jul at old rate already in YTD; Aug package is 15,000
    const result = computeTaxYearPeriodPaye({
      taxYear: 2026,
      periodStart: new Date("2026-08-01T12:00:00.000Z"),
      periodEnd: new Date("2026-08-31T12:00:00.000Z"),
      employmentStartDate: new Date("2026-01-01T00:00:00.000Z"),
      config: CONFIG_2026,
      periodTaxableEarnings: 15_000,
      currentEmployerTaxableYtdBefore: 70_000, // 10k × 7
      currentEmployerPayePaidYtdBefore: 0,
      previousEmploymentStatus: "NO_PREVIOUS_EMPLOYMENT",
      recognizePriorEmployment: false,
      periodNisEmployee: 100,
      nisEmployeePaidYtdBefore: 700,
    });

    // 70k + 15k + 15k×4 remaining after Aug = 70+15+60 = 145k (not 15k×12=180k)
    expect(result.projectedAnnualTaxable).toBe(145_000);
  });
});
