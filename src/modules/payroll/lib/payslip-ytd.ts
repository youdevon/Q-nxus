/**
 * Year-to-date totals for payslip documents.
 *
 * Rules:
 * - Only POSTED payslips count toward prior history.
 * - Calendar year comes from the payroll period (`year` / period key).
 * - Posted slip view: YTD = prior posted in year + this slip.
 * - Live preview / draft stored slip: YTD = prior posted in year + this period snapshot.
 * - Documents should always receive assembled YTD (never omit the block when a slip renders).
 * - Phase 9: prior-employer / current-employer / combined split.
 *   Combined Gross on the slip includes prior taxable income; NIS / Health /
 *   PAYE add prior statutory YTD. Display loads all ACTIVE prior rows for the
 *   tax year; PAYE withholding still uses verified totals only.
 */

import { sumMoney } from "@/src/modules/payroll/lib/money";
import type { PriorEmploymentYtdTotals } from "@/src/modules/payroll/lib/prior-employment-ytd";
import { emptyPriorEmploymentYtdTotals } from "@/src/modules/payroll/lib/prior-employment-ytd";

export type PayslipYtdContribution = {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  /** Taxable employment earnings for the period (for cumulative PAYE). */
  taxableEarnings?: number;
};

export type PayslipYtdTotals = {
  year: number;
  periodCount: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  taxableEarnings: number;
};

/** Phase 9: prior / current-employer / combined YTD labels. */
export type PayslipYtdBreakdown = {
  year: number;
  prior: {
    taxableIncome: number;
    paye: number;
    nisEmployee: number;
    healthSurcharge: number;
    recordCount: number;
  };
  currentEmployer: PayslipYtdTotals;
  combined: {
    year: number;
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    paye: number;
    nisEmployee: number;
    healthSurcharge: number;
    taxableEarnings: number;
    periodCount: number;
  };
};

export function emptyPayslipYtd(year: number): PayslipYtdTotals {
  return {
    year,
    periodCount: 0,
    grossPay: 0,
    totalDeductions: 0,
    netPay: 0,
    paye: 0,
    nisEmployee: 0,
    healthSurcharge: 0,
    taxableEarnings: 0,
  };
}

/** Sum prior posted contributions, then optionally include the current slip/preview. */
export function assemblePayslipYtd(input: {
  year: number;
  priorPosted: PayslipYtdContribution[];
  current?: PayslipYtdContribution | null;
}): PayslipYtdTotals {
  const contributions = [...input.priorPosted];

  if (input.current) {
    contributions.push(input.current);
  }

  return {
    year: input.year,
    periodCount: contributions.length,
    grossPay: sumMoney(...contributions.map((row) => row.grossPay)),
    totalDeductions: sumMoney(
      ...contributions.map((row) => row.totalDeductions),
    ),
    netPay: sumMoney(...contributions.map((row) => row.netPay)),
    paye: sumMoney(...contributions.map((row) => row.paye)),
    nisEmployee: sumMoney(...contributions.map((row) => row.nisEmployee)),
    healthSurcharge: sumMoney(
      ...contributions.map((row) => row.healthSurcharge),
    ),
    taxableEarnings: sumMoney(
      ...contributions.map((row) => row.taxableEarnings ?? row.grossPay),
    ),
  };
}

export function assemblePayslipYtdBreakdown(input: {
  year: number;
  currentEmployer: PayslipYtdTotals;
  prior?: PriorEmploymentYtdTotals | null;
}): PayslipYtdBreakdown {
  const prior = input.prior ?? emptyPriorEmploymentYtdTotals();

  return {
    year: input.year,
    prior: {
      taxableIncome: prior.taxableIncomeYtd,
      paye: prior.payeDeductedYtd,
      nisEmployee: prior.nisEmployeeYtd,
      healthSurcharge: prior.healthSurchargeYtd,
      recordCount: prior.recordCount,
    },
    currentEmployer: input.currentEmployer,
    combined: {
      year: input.year,
      // Slip "Gross" YTD uses prior taxable income (TD4 / letter YTD), same as
      // taxableEarnings — prior employers do not store a separate gross figure.
      grossPay: sumMoney(
        input.currentEmployer.grossPay,
        prior.taxableIncomeYtd,
      ),
      totalDeductions: input.currentEmployer.totalDeductions,
      netPay: input.currentEmployer.netPay,
      paye: sumMoney(input.currentEmployer.paye, prior.payeDeductedYtd),
      nisEmployee: sumMoney(
        input.currentEmployer.nisEmployee,
        prior.nisEmployeeYtd,
      ),
      healthSurcharge: sumMoney(
        input.currentEmployer.healthSurcharge,
        prior.healthSurchargeYtd,
      ),
      taxableEarnings: sumMoney(
        input.currentEmployer.taxableEarnings,
        prior.taxableIncomeYtd,
      ),
      periodCount: input.currentEmployer.periodCount + prior.recordCount,
    },
  };
}

/** Extract calendar year from a monthly period key (`YYYY-MM`). */
export function yearFromPeriodKey(
  periodKey: string | null | undefined,
): number | null {
  const match = periodKey?.trim().match(/^(\d{4})-(0[1-9]|1[0-2])$/);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

/** Derive `YYYY-MM` from a payslip `asOf` ISO date (Trinidad month). */
export function periodKeyFromAsOf(asOf: string | Date): string | null {
  const date = typeof asOf === "string" ? new Date(asOf) : asOf;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-TT", {
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Port_of_Spain",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    return null;
  }

  return `${year}-${month}`;
}
