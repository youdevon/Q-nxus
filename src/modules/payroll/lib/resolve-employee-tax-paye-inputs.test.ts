import { describe, expect, it } from "vitest";

import {
  applyPersonalAllowanceOverride,
  resolveEmployeeTaxPayeInputs,
} from "@/src/modules/payroll/lib/resolve-employee-tax-paye-inputs";

describe("resolveEmployeeTaxPayeInputs", () => {
  it("prefers tax profile TD1 over payroll profile", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: {
        taxCalculationMethod: "STANDARD_NON_CUMULATIVE",
        taxProfileStatus: "ACTIVE",
        personalAllowance: null,
        personalAllowanceSource: "STATUTORY_DEFAULT",
        td1OtherApprovedAnnual: 12_000,
        cumulativeCalculationEnabled: false,
        previousEmploymentDeclared: false,
        previousEmploymentVerified: false,
      },
      payrollProfile: { td1OtherApprovedAnnual: 5_000 },
    });

    expect(result.source).toBe("tax_profile");
    expect(result.td1OtherApprovedAnnual).toBe(12_000);
    expect(result.personalAllowanceOverride).toBeNull();
  });

  it("falls back to payroll profile when no tax profile", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: null,
      payrollProfile: { td1OtherApprovedAnnual: 8_500 },
    });

    expect(result.source).toBe("payroll_profile");
    expect(result.td1OtherApprovedAnnual).toBe(8_500);
    expect(result.taxCalculationMethod).toBe("STANDARD_NON_CUMULATIVE");
  });

  it("uses payroll TD1 when tax profile omits TD1 amount", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: {
        taxCalculationMethod: "STANDARD_NON_CUMULATIVE",
        taxProfileStatus: "ACTIVE",
        personalAllowance: 90_000,
        personalAllowanceSource: "TD1",
        td1OtherApprovedAnnual: null,
        cumulativeCalculationEnabled: false,
        previousEmploymentDeclared: false,
        previousEmploymentVerified: false,
      },
      payrollProfile: { td1OtherApprovedAnnual: 3_000 },
    });

    expect(result.td1OtherApprovedAnnual).toBe(3_000);
    expect(result.personalAllowanceOverride).toBe(90_000);
  });

  it("adds calc notes for previous employment without records", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: {
        taxCalculationMethod: "STANDARD_CUMULATIVE",
        taxProfileStatus: "ACTIVE",
        personalAllowance: null,
        personalAllowanceSource: "STATUTORY_DEFAULT",
        td1OtherApprovedAnnual: 0,
        cumulativeCalculationEnabled: true,
        previousEmploymentDeclared: true,
        previousEmploymentVerified: false,
      },
      payrollProfile: null,
    });

    expect(result.calcNotes.length).toBeGreaterThanOrEqual(1);
    expect(result.priorEmployment.recordCount).toBe(0);
  });

  it("includes aggregated prior-employer YTD", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: {
        taxCalculationMethod: "PREVIOUS_INCOME_INCLUDED",
        taxProfileStatus: "ACTIVE",
        personalAllowance: null,
        personalAllowanceSource: "STATUTORY_DEFAULT",
        td1OtherApprovedAnnual: null,
        cumulativeCalculationEnabled: false,
        previousEmploymentDeclared: true,
        previousEmploymentVerified: true,
      },
      payrollProfile: null,
      priorEmployment: {
        taxableIncomeYtd: 25_000,
        payeDeductedYtd: 1_500,
        nisEmployeeYtd: 800,
        nisEmployerYtd: 1_600,
        healthSurchargeYtd: 40,
        otherApprovedDeductionsYtd: 0,
        recordCount: 1,
        verifiedCount: 1,
        allVerified: true,
      },
    });

    expect(result.priorEmployment.taxableIncomeYtd).toBe(25_000);
    expect(result.calcNotes.some((note) => note.includes("Prior-employer YTD"))).toBe(
      true,
    );
  });
});

describe("applyPersonalAllowanceOverride", () => {
  it("replaces personal allowance when override is set", () => {
    expect(
      applyPersonalAllowanceOverride(
        { personalAllowanceAnnual: 90_000, other: 1 },
        100_000,
      ),
    ).toEqual({ personalAllowanceAnnual: 100_000, other: 1 });
  });

  it("leaves config unchanged when override is null", () => {
    const config = { personalAllowanceAnnual: 90_000 };
    expect(applyPersonalAllowanceOverride(config, null)).toBe(config);
  });
});
