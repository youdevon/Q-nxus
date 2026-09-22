import { describe, expect, it } from "vitest";

import {
  applyPersonalAllowanceOverride,
  resolveEmployeeTaxPayeInputs,
} from "@/src/modules/payroll/lib/resolve-employee-tax-paye-inputs";

const baseProfile = {
  taxCalculationMethod: "STANDARD_NON_CUMULATIVE" as const,
  taxProfileStatus: "ACTIVE" as const,
  personalAllowance: null as number | null,
  personalAllowanceSource: "STATUTORY_DEFAULT" as const,
  td1OtherApprovedAnnual: null as number | null,
  cumulativeCalculationEnabled: false,
  previousEmploymentStatus: "NO_PREVIOUS_EMPLOYMENT" as const,
  previousEmploymentDeclared: false,
  previousEmploymentVerified: false,
  otherEmolumentIncomeStatus: "UNKNOWN_OTHER_EMOLUMENTS" as const,
  birDirectionPresent: false,
  birDirectionReference: null as string | null,
};

describe("resolveEmployeeTaxPayeInputs", () => {
  it("reads TD1 from the tax profile", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: {
        ...baseProfile,
        td1OtherApprovedAnnual: 12_000,
      },
    });

    expect(result.source).toBe("tax_profile");
    expect(result.td1OtherApprovedAnnual).toBe(12_000);
    expect(result.personalAllowanceOverride).toBeNull();
    expect(result.previousEmploymentStatus).toBe("NO_PREVIOUS_EMPLOYMENT");
    expect(result.priorEmploymentDataRequired).toBe(false);
  });

  it("returns none when no tax profile", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: null,
    });

    expect(result.source).toBe("none");
    expect(result.td1OtherApprovedAnnual).toBe(0);
    expect(result.taxCalculationMethod).toBe("STANDARD_NON_CUMULATIVE");
    expect(result.previousEmploymentStatus).toBe("UNKNOWN_PREVIOUS_INCOME");
    expect(result.priorEmploymentDataRequired).toBe(true);
  });

  it("treats null tax-profile TD1 as zero", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: {
        ...baseProfile,
        personalAllowance: 90_000,
        personalAllowanceSource: "TD1",
        td1OtherApprovedAnnual: null,
      },
    });

    expect(result.td1OtherApprovedAnnual).toBe(0);
    expect(result.personalAllowanceOverride).toBe(90_000);
  });

  it("syncs declared from PREVIOUS_EMPLOYMENT status", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: {
        ...baseProfile,
        taxCalculationMethod: "STANDARD_CUMULATIVE",
        cumulativeCalculationEnabled: true,
        previousEmploymentStatus: "PREVIOUS_EMPLOYMENT",
        previousEmploymentDeclared: false,
        previousEmploymentVerified: false,
      },
    });

    expect(result.previousEmploymentDeclared).toBe(true);
    expect(result.calcNotes.length).toBeGreaterThanOrEqual(1);
    expect(result.priorEmployment.recordCount).toBe(0);
  });

  it("flags UNKNOWN as priorEmploymentDataRequired without assuming zero", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: {
        ...baseProfile,
        previousEmploymentStatus: "UNKNOWN_PREVIOUS_INCOME",
      },
    });

    expect(result.priorEmploymentDataRequired).toBe(true);
    expect(result.previousEmploymentDeclared).toBe(false);
    expect(
      result.calcNotes.some((note) =>
        note.includes("not assumed to be zero"),
      ),
    ).toBe(true);
  });

  it("includes aggregated prior-employer YTD", () => {
    const result = resolveEmployeeTaxPayeInputs({
      taxYear: 2026,
      taxProfile: {
        ...baseProfile,
        taxCalculationMethod: "PREVIOUS_INCOME_INCLUDED",
        previousEmploymentStatus: "PREVIOUS_EMPLOYMENT",
        previousEmploymentDeclared: true,
        previousEmploymentVerified: true,
      },
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
    expect(result.previousEmploymentStatus).toBe("PREVIOUS_EMPLOYMENT");
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
