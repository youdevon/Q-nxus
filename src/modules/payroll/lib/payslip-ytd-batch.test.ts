import { describe, expect, it } from "vitest";

import {
  assemblePayslipYtd,
  type PayslipYtdContribution,
} from "@/src/modules/payroll/lib/payslip-ytd";

describe("batch YTD assembly helpers", () => {
  it("sums prior contributions with current for period count", () => {
    const prior: PayslipYtdContribution[] = [
      {
        grossPay: 1000,
        totalDeductions: 100,
        netPay: 900,
        paye: 50,
        nisEmployee: 30,
        healthSurcharge: 20,
      },
      {
        grossPay: 1000,
        totalDeductions: 100,
        netPay: 900,
        paye: 50,
        nisEmployee: 30,
        healthSurcharge: 20,
      },
    ];
    const current: PayslipYtdContribution = {
      grossPay: 1000,
      totalDeductions: 100,
      netPay: 900,
      paye: 50,
      nisEmployee: 30,
      healthSurcharge: 20,
    };

    const ytd = assemblePayslipYtd({
      year: 2026,
      priorPosted: prior,
      current,
    });

    expect(ytd.periodCount).toBe(3);
    expect(ytd.grossPay).toBe(3000);
    expect(ytd.paye).toBe(150);
  });
});
