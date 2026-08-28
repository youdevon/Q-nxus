import { describe, expect, it } from "vitest";

import {
  assemblePayslipYtd,
  assemblePayslipYtdBreakdown,
  emptyPayslipYtd,
  type PayslipYtdContribution,
  periodKeyFromAsOf,
  yearFromPeriodKey,
} from "./payslip-ytd";

function contribution(
  grossPay: number,
  totalDeductions: number,
  netPay: number,
  paye = 0,
  nisEmployee = 0,
  healthSurcharge = 0,
): PayslipYtdContribution {
  return {
    grossPay,
    totalDeductions,
    netPay,
    paye,
    nisEmployee,
    healthSurcharge,
  };
}

describe("yearFromPeriodKey", () => {
  it("parses a monthly period key", () => {
    expect(yearFromPeriodKey("2026-07")).toBe(2026);
    expect(yearFromPeriodKey("2025-12")).toBe(2025);
  });

  it("rejects invalid keys", () => {
    expect(yearFromPeriodKey("2026")).toBeNull();
    expect(yearFromPeriodKey("2026-13")).toBeNull();
    expect(yearFromPeriodKey(null)).toBeNull();
  });
});

describe("periodKeyFromAsOf", () => {
  it("derives YYYY-MM from an asOf date", () => {
    expect(periodKeyFromAsOf("2026-06-30T12:00:00.000Z")).toBe("2026-06");
  });
});

describe("assemblePayslipYtd", () => {
  it("returns empty totals when there is no history or current slip", () => {
    expect(assemblePayslipYtd({ year: 2026, priorPosted: [] })).toEqual(
      emptyPayslipYtd(2026),
    );
  });

  it("sums prior posted slips only when current is omitted", () => {
    const ytd = assemblePayslipYtd({
      year: 2026,
      priorPosted: [
        contribution(10_000, 1_000, 9_000),
        contribution(10_000, 1_200, 8_800),
      ],
    });

    expect(ytd).toEqual({
      year: 2026,
      periodCount: 2,
      grossPay: 20_000,
      totalDeductions: 2_200,
      netPay: 17_800,
      paye: 0,
      nisEmployee: 0,
      healthSurcharge: 0,
      taxableEarnings: 20_000,
    });
  });

  it("includes the current slip for posted views", () => {
    const ytd = assemblePayslipYtd({
      year: 2026,
      priorPosted: [contribution(10_000, 1_000, 9_000, 500, 250, 20)],
      current: contribution(10_500, 1_100, 9_400, 550, 260, 33),
    });

    expect(ytd.periodCount).toBe(2);
    expect(ytd.grossPay).toBe(20_500);
    expect(ytd.totalDeductions).toBe(2_100);
    expect(ytd.netPay).toBe(18_400);
    expect(ytd.paye).toBe(1_050);
    expect(ytd.nisEmployee).toBe(510);
    expect(ytd.healthSurcharge).toBe(53);
  });

  it("includes the live preview as the current contribution", () => {
    const ytd = assemblePayslipYtd({
      year: 2026,
      priorPosted: [
        contribution(8_000.55, 500.25, 7_500.3),
      ],
      current: contribution(8_000.55, 500.25, 7_500.3),
    });

    expect(ytd.periodCount).toBe(2);
    expect(ytd.grossPay).toBe(16_001.1);
    expect(ytd.totalDeductions).toBe(1_000.5);
    expect(ytd.netPay).toBe(15_000.6);
  });

  it("rounds money to two decimal places", () => {
    const ytd = assemblePayslipYtd({
      year: 2026,
      priorPosted: [contribution(0.1, 0.2, 0.3, 0.01, 0.02, 0.03)],
      current: contribution(0.2, 0.1, 0.1, 0.02, 0.01, 0.02),
    });

    expect(ytd.grossPay).toBe(0.3);
    expect(ytd.totalDeductions).toBe(0.3);
    expect(ytd.netPay).toBe(0.4);
    expect(ytd.paye).toBe(0.03);
    expect(ytd.nisEmployee).toBe(0.03);
    expect(ytd.healthSurcharge).toBe(0.05);
  });
});

describe("assemblePayslipYtdBreakdown", () => {
  it("splits prior / this employer / combined when prior records exist", () => {
    const currentEmployer = {
      year: 2026,
      periodCount: 2,
      grossPay: 36_000,
      totalDeductions: 8_000,
      netPay: 28_000,
      paye: 5_000,
      nisEmployee: 1_469,
      healthSurcharge: 71.5,
      taxableEarnings: 36_000,
    };

    const breakdown = assemblePayslipYtdBreakdown({
      year: 2026,
      currentEmployer,
      prior: {
        taxableIncomeYtd: 45_000,
        payeDeductedYtd: 6_250,
        nisEmployeeYtd: 2_200,
        nisEmployerYtd: 4_400,
        healthSurchargeYtd: 107.25,
        otherApprovedDeductionsYtd: 0,
        recordCount: 1,
        verifiedCount: 1,
        allVerified: true,
      },
    });

    expect(breakdown.prior).toEqual({
      taxableIncome: 45_000,
      paye: 6_250,
      nisEmployee: 2_200,
      healthSurcharge: 107.25,
      recordCount: 1,
    });
    expect(breakdown.currentEmployer).toEqual(currentEmployer);
    expect(breakdown.combined.paye).toBe(11_250);
    expect(breakdown.combined.nisEmployee).toBe(3_669);
    expect(breakdown.combined.healthSurcharge).toBe(178.75);
    expect(breakdown.combined.taxableEarnings).toBe(81_000);
    // Gross YTD on the slip = this-employer gross + prior taxable income.
    expect(breakdown.combined.grossPay).toBe(81_000);
    expect(breakdown.combined.periodCount).toBe(3);
  });

  it("folds Devon mid-year joiner prior into combined Gross / PAYE", () => {
    const breakdown = assemblePayslipYtdBreakdown({
      year: 2026,
      currentEmployer: {
        year: 2026,
        periodCount: 1,
        grossPay: 18_000,
        totalDeductions: 3_500,
        netPay: 14_500,
        paye: 2_796.46,
        nisEmployee: 500,
        healthSurcharge: 33,
        taxableEarnings: 18_000,
      },
      prior: {
        taxableIncomeYtd: 69_000,
        payeDeductedYtd: 3_645,
        nisEmployeeYtd: 0,
        nisEmployerYtd: 0,
        healthSurchargeYtd: 0,
        otherApprovedDeductionsYtd: 0,
        recordCount: 1,
        verifiedCount: 1,
        allVerified: true,
      },
    });

    expect(breakdown.combined.grossPay).toBe(87_000);
    expect(breakdown.combined.paye).toBe(6_441.46);
    expect(breakdown.combined.nisEmployee).toBe(500);
    expect(breakdown.combined.healthSurcharge).toBe(33);
    expect(breakdown.prior.recordCount).toBe(1);
  });

  it("keeps prior.recordCount at 0 when there is no prior employer", () => {
    const breakdown = assemblePayslipYtdBreakdown({
      year: 2026,
      currentEmployer: emptyPayslipYtd(2026),
    });

    expect(breakdown.prior.recordCount).toBe(0);
    expect(breakdown.combined.paye).toBe(0);
  });
});
