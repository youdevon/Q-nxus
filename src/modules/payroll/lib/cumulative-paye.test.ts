import { describe, expect, it } from "vitest";

import {
  clampMonthsElapsed,
  computeCumulativePayeContribution,
  monthsElapsedFromPeriodEnd,
  shouldUseCumulativePaye,
} from "@/src/modules/payroll/lib/cumulative-paye";
import { TT_PAYE_2026_CONFIG } from "@/src/modules/payroll/lib/paye-contribution";

describe("computeCumulativePayeContribution", () => {
  it("charges full monthly PAYE in month 1 with no prior history", () => {
    const result = computeCumulativePayeContribution({
      periodTaxableEarnings: 10_000,
      currentEmployerTaxableYtd: 0,
      currentEmployerPayePaidYtd: 0,
      monthsElapsed: 1,
      config: TT_PAYE_2026_CONFIG,
      employeeNisWeekly: 0,
      periodNisEmployee: 0,
    });

    // Annual taxable 120k, allowance 90k → chargeable 30k @ 25% = 7500 → taxToDate 7500/12
    expect(result.projectedAnnualTaxable).toBe(120_000);
    expect(result.annualTax).toBe(7_500);
    expect(result.taxToDate).toBe(625);
    expect(result.periodPaye).toBe(625);
    expect(result.monthlyPaye).toBe(625);
    expect(result.nisDeductibleSource).toBe("weekly_annualized");
  });

  it("subtracts prior-employer and current YTD PAYE already paid", () => {
    const result = computeCumulativePayeContribution({
      periodTaxableEarnings: 10_000,
      currentEmployerTaxableYtd: 20_000,
      currentEmployerPayePaidYtd: 400,
      priorTaxableYtd: 30_000,
      priorPayePaidYtd: 1_000,
      monthsElapsed: 6,
      config: TT_PAYE_2026_CONFIG,
      nisEmployeePaidYtdBefore: 3_000,
      periodNisEmployee: 500,
      otherApprovedDeductionsAnnual: 0,
    });

    expect(result.ytdTaxableIncome).toBe(60_000);
    expect(result.projectedAnnualTaxable).toBe(120_000);
    expect(result.nisDeductibleSource).toBe("ytd_paid");
    expect(result.payePaidYtdBefore).toBe(1_400);
    expect(result.periodPaye).toBe(
      Math.max(0, result.taxToDate - 1_400),
    );
  });

  it("can produce zero period PAYE when already over-withheld", () => {
    const result = computeCumulativePayeContribution({
      periodTaxableEarnings: 5_000,
      currentEmployerTaxableYtd: 5_000,
      currentEmployerPayePaidYtd: 5_000,
      monthsElapsed: 2,
      config: TT_PAYE_2026_CONFIG,
    });
    expect(result.periodPaye).toBe(0);
  });
});

describe("shouldUseCumulativePaye", () => {
  it("detects cumulative methods and flag", () => {
    expect(
      shouldUseCumulativePaye({ taxCalculationMethod: "STANDARD_CUMULATIVE" }),
    ).toBe(true);
    expect(
      shouldUseCumulativePaye({
        taxCalculationMethod: "PREVIOUS_INCOME_INCLUDED",
      }),
    ).toBe(true);
    expect(
      shouldUseCumulativePaye({ cumulativeCalculationEnabled: true }),
    ).toBe(true);
    expect(
      shouldUseCumulativePaye({
        taxCalculationMethod: "STANDARD_NON_CUMULATIVE",
      }),
    ).toBe(false);
  });
});

describe("months helpers", () => {
  it("clamps and parses period end", () => {
    expect(clampMonthsElapsed(0)).toBe(1);
    expect(clampMonthsElapsed(15)).toBe(12);
    expect(monthsElapsedFromPeriodEnd("2026-07-31")).toBe(7);
  });
});
