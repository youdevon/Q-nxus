import { describe, expect, it } from "vitest";

import { computeAnnualPayeProjection } from "@/src/modules/payroll/lib/annual-paye-projection";
import { computeQualifyingDeductionBreakdown } from "@/src/modules/payroll/lib/qualifying-deductions";
import {
  countRemainingMonthlyPeriods,
  listRemainingMonthlyPeriodEnds,
  resolveRemainingPayrollPeriods,
} from "@/src/modules/payroll/lib/remaining-payroll-periods";

const TT_2026_CONFIG = {
  personalAllowanceAnnual: 90_000,
  nisDeductiblePortion: 0.7,
  approvedDeductionCapAnnual: 60_000,
  brackets: [
    { upToAmount: 1_000_000, ratePercent: 25, sortOrder: 1 },
    { upToAmount: null, ratePercent: 30, sortOrder: 2 },
  ],
};

describe("remaining payroll periods (monthly)", () => {
  it("counts remaining months after July in a full year", () => {
    const result = countRemainingMonthlyPeriods({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      projectionEndDate: new Date("2026-12-31T00:00:00.000Z"),
    });

    expect(result.periodsElapsed).toBe(7);
    expect(result.remainingPeriods).toBe(5);
  });

  it("lists remaining month-end dates after July", () => {
    const ends = listRemainingMonthlyPeriodEnds({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      projectionEndDate: new Date("2026-12-31T00:00:00.000Z"),
    });

    expect(ends.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });

  it("shortens remaining periods when contract ends before year-end", () => {
    const result = resolveRemainingPayrollPeriods({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      employmentEndDate: new Date("2026-10-31T00:00:00.000Z"),
    });

    expect(result.remainingPeriods).toBe(3);
    expect(result.projectionEndDate).toBe("2026-10-31");
    expect(result.frequencySupported).toBe(true);
  });
});

describe("qualifying deductions", () => {
  it("applies 70% of employee NIS and caps at annual limit", () => {
    const breakdown = computeQualifyingDeductionBreakdown({
      employeeNisAnnual: 6_000,
      nisDeductiblePortion: 0.7,
      pensionContributionAnnual: 50_000,
      approvedDeductionCapAnnual: 60_000,
    });

    expect(breakdown.qualifyingNisAmount).toBe(4_200);
    expect(breakdown.grossQualifyingAmount).toBe(54_200);
    expect(breakdown.allowableQualifyingDeduction).toBe(54_200);
    expect(breakdown.capped).toBe(false);
  });

  it("caps pension + NIS at annual limit", () => {
    const breakdown = computeQualifyingDeductionBreakdown({
      employeeNisAnnual: 10_000,
      nisDeductiblePortion: 0.7,
      pensionContributionAnnual: 58_000,
      approvedDeductionCapAnnual: 60_000,
    });

    expect(breakdown.grossQualifyingAmount).toBe(65_000);
    expect(breakdown.allowableQualifyingDeduction).toBe(60_000);
    expect(breakdown.capped).toBe(true);
  });
});

describe("annual PAYE projection", () => {
  it("matches the mid-year joiner worksheet example shape", () => {
    const result = computeAnnualPayeProjection({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      config: TT_2026_CONFIG,
      previousEmployerVerified: true,
      previousEmployer: {
        taxableEarnings: 72_000,
        paye: 7_000,
        employeeNis: 2_000,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      currentEmployerActual: {
        taxableEarnings: 36_000,
        paye: 2_000,
        employeeNis: 1_000,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      projectedTaxablePerRemainingPeriod: 14_400,
      projectedNisPerRemainingPeriod: 400,
      projectedPensionPerRemainingPeriod: 1_600,
      td1OtherApprovedAnnual: 0,
    });

    expect(result.periods.remainingPeriods).toBe(5);
    expect(result.projectedRemaining.taxableEarnings).toBe(72_000);
    expect(result.projectedAnnual.taxableEarnings).toBe(180_000);
    expect(result.personalAllowance).toBe(90_000);
    expect(result.qualifying.qualifyingNisAmount).toBe(3_500);
    expect(result.projectedChargeableIncome).toBeGreaterThan(0);
    expect(result.previousEmployerPaye).toBe(7_000);
    expect(result.currentEmployerPaye).toBe(2_000);
    expect(result.recommendedPayePerPeriod).not.toBeNull();
  });

  it("excludes unverified previous employer from applied calc", () => {
    const result = computeAnnualPayeProjection({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      config: TT_2026_CONFIG,
      previousEmployerVerified: false,
      includeUnverifiedPreviousInPreview: false,
      previousEmployer: {
        taxableEarnings: 72_000,
        paye: 7_000,
        employeeNis: 2_000,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      currentEmployerActual: {
        taxableEarnings: 36_000,
        paye: 2_000,
        employeeNis: 1_000,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      projectedTaxablePerRemainingPeriod: 14_400,
    });

    expect(result.previousEmployerExcludedUnverified).toBe(true);
    expect(result.previousEmployer.taxableEarnings).toBe(0);
    expect(result.previousEmployerPaye).toBe(0);
    expect(result.projectedAnnual.taxableEarnings).toBe(36_000 + 72_000);
  });

  it("full-year employee with no prior uses remaining periods only", () => {
    const result = computeAnnualPayeProjection({
      taxYear: 2026,
      asOfDate: new Date("2026-01-31T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      config: TT_2026_CONFIG,
      previousEmployerVerified: true,
      previousEmployer: {
        taxableEarnings: 0,
        paye: 0,
        employeeNis: 0,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      currentEmployerActual: {
        taxableEarnings: 15_000,
        paye: 500,
        employeeNis: 300,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      projectedTaxablePerRemainingPeriod: 15_000,
      projectedNisPerRemainingPeriod: 300,
    });

    expect(result.periods.remainingPeriods).toBe(11);
    expect(result.projectedAnnual.taxableEarnings).toBe(15_000 * 12);
    expect(result.recommendedPayePerPeriod).not.toBeNull();
  });

  it("applies manual tax adjustment to remaining liability", () => {
    const base = computeAnnualPayeProjection({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      config: TT_2026_CONFIG,
      previousEmployerVerified: true,
      previousEmployer: {
        taxableEarnings: 0,
        paye: 0,
        employeeNis: 0,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      currentEmployerActual: {
        taxableEarnings: 90_000,
        paye: 5_000,
        employeeNis: 2_000,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      projectedTaxablePerRemainingPeriod: 15_000,
      projectedNisPerRemainingPeriod: 400,
      manualTaxAdjustment: 0,
    });

    const adjusted = computeAnnualPayeProjection({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      config: TT_2026_CONFIG,
      previousEmployerVerified: true,
      previousEmployer: {
        taxableEarnings: 0,
        paye: 0,
        employeeNis: 0,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      currentEmployerActual: {
        taxableEarnings: 90_000,
        paye: 5_000,
        employeeNis: 2_000,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      projectedTaxablePerRemainingPeriod: 15_000,
      projectedNisPerRemainingPeriod: 400,
      manualTaxAdjustment: 1_200,
    });

    expect(adjusted.manualTaxAdjustment).toBe(1_200);
    expect(adjusted.remainingTaxLiability).toBe(
      base.remainingTaxLiability + 1_200,
    );
  });

  it("returns null recommended PAYE when no remaining periods", () => {
    const result = computeAnnualPayeProjection({
      taxYear: 2026,
      asOfDate: new Date("2026-12-31T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      config: TT_2026_CONFIG,
      previousEmployerVerified: true,
      previousEmployer: {
        taxableEarnings: 0,
        paye: 0,
        employeeNis: 0,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      currentEmployerActual: {
        taxableEarnings: 180_000,
        paye: 20_000,
        employeeNis: 5_000,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      projectedTaxablePerRemainingPeriod: 15_000,
    });

    expect(result.periods.remainingPeriods).toBe(0);
    expect(result.recommendedPayePerPeriod).toBeNull();
  });

  it("marks non-monthly frequency as unsupported approximation", () => {
    const result = resolveRemainingPayrollPeriods({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      payFrequency: "FORTNIGHTLY",
    });

    expect(result.frequencySupported).toBe(false);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("keeps chargeable income non-negative below allowance", () => {
    const result = computeAnnualPayeProjection({
      taxYear: 2026,
      asOfDate: new Date("2026-06-30T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      config: TT_2026_CONFIG,
      previousEmployerVerified: true,
      previousEmployer: {
        taxableEarnings: 0,
        paye: 0,
        employeeNis: 0,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      currentEmployerActual: {
        taxableEarnings: 20_000,
        paye: 0,
        employeeNis: 500,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      projectedTaxablePerRemainingPeriod: 4_000,
      projectedNisPerRemainingPeriod: 100,
    });

    expect(result.projectedChargeableIncome).toBe(0);
    expect(result.projectedAnnualTaxLiability).toBe(0);
  });

  it("does not double-count prior other qualifying with TD1", () => {
    const result = computeAnnualPayeProjection({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      config: TT_2026_CONFIG,
      previousEmployerVerified: true,
      previousEmployer: {
        taxableEarnings: 0,
        paye: 0,
        employeeNis: 0,
        pensionContribution: 0,
        otherQualifyingContribution: 10_000,
      },
      currentEmployerActual: {
        taxableEarnings: 120_000,
        paye: 5_000,
        employeeNis: 0,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      projectedTaxablePerRemainingPeriod: 0,
      td1OtherApprovedAnnual: 5_000,
    });

    // 10k prior + 5k TD1 = 15k (not 20k from double-counting prior)
    expect(result.qualifying.otherQualifyingContribution).toBe(15_000);
    expect(result.qualifying.grossQualifyingAmount).toBe(15_000);
  });

  it("honours formula overrides for remaining periods and NIS portion", () => {
    const result = computeAnnualPayeProjection({
      taxYear: 2026,
      asOfDate: new Date("2026-07-31T00:00:00.000Z"),
      payFrequency: "MONTHLY",
      config: TT_2026_CONFIG,
      previousEmployerVerified: true,
      previousEmployer: {
        taxableEarnings: 0,
        paye: 0,
        employeeNis: 0,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      currentEmployerActual: {
        taxableEarnings: 90_000,
        paye: 0,
        employeeNis: 10_000,
        pensionContribution: 0,
        otherQualifyingContribution: 0,
      },
      projectedTaxablePerRemainingPeriod: 10_000,
      projectedNisPerRemainingPeriod: 1_000,
      formulaOverrides: {
        remainingPeriods: 3,
        nisDeductiblePortion: 0.5,
        approvedDeductionCapAnnual: 50_000,
      },
    });

    expect(result.periods.remainingPeriods).toBe(3);
    expect(result.projectedRemaining.taxableEarnings).toBe(30_000);
    expect(result.qualifying.nisDeductiblePortion).toBe(0.5);
    // (10k YTD + 3k remaining) * 0.5 = 6_500
    expect(result.qualifying.qualifyingNisAmount).toBe(6_500);
    expect(result.qualifying.annualCap).toBe(50_000);
    expect(
      result.warnings.some((w) => w.includes("Remaining periods manually")),
    ).toBe(true);
  });
});

describe("projected tax-year position mapping", () => {
  it("maps approved projection row fields", async () => {
    const { toProjectedTaxYearPosition } = await import(
      "@/src/modules/payroll/lib/projected-tax-year-position"
    );
    const mapped = toProjectedTaxYearPosition({
      taxYear: 2026,
      version: 3,
      payFrequency: "MONTHLY",
      previousEmployerTaxableIncome: 69_000,
      previousEmployerPaye: 3_645,
      currentEmployerActualTaxableIncome: 0,
      currentEmployerPaye: 0,
      projectedRemainingTaxableIncome: 108_000,
      projectedAnnualTaxableIncome: 177_000,
      personalAllowance: 90_000,
      allowableQualifyingDeduction: 5_305,
      projectedChargeableIncome: 81_695,
      projectedAnnualTaxLiability: 20_423.75,
      manualTaxAdjustment: 0,
      remainingTaxLiability: 16_778.75,
      remainingPayrollPeriods: 6,
      recommendedPayePerPeriod: 2_796.46,
      calculationDate: new Date("2026-07-15T00:00:00.000Z"),
    });

    expect(mapped.version).toBe(3);
    expect(mapped.payFrequency).toBe("MONTHLY");
    expect(mapped.previousEmployerTaxableIncome).toBe(69_000);
    expect(mapped.projectedChargeableIncome).toBe(81_695);
    expect(mapped.recommendedPayePerPeriod).toBe(2_796.46);
    expect(mapped.calculationDate).toBe("2026-07-15");
  });
});

describe("earning treatment taxability", () => {
  it("only TAXABLE_EMPLOYMENT is PAYE-taxable", async () => {
    const { isTaxableFromTreatment } = await import(
      "@/src/modules/payroll/lib/earning-treatment"
    );
    expect(isTaxableFromTreatment("TAXABLE_EMPLOYMENT")).toBe(true);
    expect(isTaxableFromTreatment("NON_TAXABLE")).toBe(false);
    expect(isTaxableFromTreatment("NIS_ONLY")).toBe(false);
    expect(isTaxableFromTreatment("PAYE_EXEMPT")).toBe(false);
  });
});
