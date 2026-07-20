import { describe, expect, it } from "vitest";

import {
  aggregatePriorEmploymentYtd,
  priorEmploymentCalcNotes,
} from "@/src/modules/payroll/lib/prior-employment-ytd";

describe("aggregatePriorEmploymentYtd", () => {
  it("returns empty totals for no records", () => {
    expect(aggregatePriorEmploymentYtd([])).toEqual({
      taxableIncomeYtd: 0,
      payeDeductedYtd: 0,
      nisEmployeeYtd: 0,
      nisEmployerYtd: 0,
      healthSurchargeYtd: 0,
      otherApprovedDeductionsYtd: 0,
      recordCount: 0,
      verifiedCount: 0,
      allVerified: true,
    });
  });

  it("sums multiple prior employers", () => {
    const totals = aggregatePriorEmploymentYtd([
      {
        taxableIncomeYtd: 40_000,
        payeDeductedYtd: 2_000,
        nisEmployeeYtd: 1_000,
        nisEmployerYtd: 2_000,
        healthSurchargeYtd: 100,
        otherApprovedDeductionsYtd: 500,
        verified: true,
      },
      {
        taxableIncomeYtd: 10_000.555,
        payeDeductedYtd: 500.4,
        nisEmployeeYtd: null as unknown as number,
        nisEmployerYtd: 0,
        healthSurchargeYtd: 50,
        otherApprovedDeductionsYtd: 0,
        verified: false,
      },
    ]);

    expect(totals.recordCount).toBe(2);
    expect(totals.verifiedCount).toBe(1);
    expect(totals.allVerified).toBe(false);
    expect(totals.taxableIncomeYtd).toBe(50_000.56);
    expect(totals.payeDeductedYtd).toBe(2_500.4);
    expect(totals.nisEmployeeYtd).toBe(1_000);
  });
});

describe("priorEmploymentCalcNotes", () => {
  it("warns when declared without records", () => {
    const notes = priorEmploymentCalcNotes({
      previousEmploymentDeclared: true,
      taxCalculationMethodIncludesPrevious: false,
      totals: aggregatePriorEmploymentYtd([]),
    });
    expect(notes[0]).toMatch(/no prior-employer YTD records/);
  });

  it("summarizes captured YTD", () => {
    const notes = priorEmploymentCalcNotes({
      previousEmploymentDeclared: true,
      taxCalculationMethodIncludesPrevious: true,
      totals: aggregatePriorEmploymentYtd([
        {
          taxableIncomeYtd: 20_000,
          payeDeductedYtd: 1_000,
          nisEmployeeYtd: 0,
          nisEmployerYtd: 0,
          healthSurchargeYtd: 0,
          otherApprovedDeductionsYtd: 0,
          verified: true,
        },
      ]),
    });
    expect(notes[0]).toMatch(/Prior-employer YTD on file/);
  });
});
