/**
 * Year-to-date totals for payslip documents.
 *
 * Rules:
 * - Only POSTED payslips count toward history.
 * - Calendar year comes from the payroll period (`year` / period key).
 * - Posted slip view: YTD = prior posted in year + this slip.
 * - Live preview: YTD = prior posted in year + this preview period.
 */

export type PayslipYtdContribution = {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

export type PayslipYtdTotals = {
  year: number;
  periodCount: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function emptyPayslipYtd(year: number): PayslipYtdTotals {
  return {
    year,
    periodCount: 0,
    grossPay: 0,
    totalDeductions: 0,
    netPay: 0,
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

  const totals = contributions.reduce(
    (acc, row) => {
      acc.grossPay += row.grossPay;
      acc.totalDeductions += row.totalDeductions;
      acc.netPay += row.netPay;
      return acc;
    },
    { grossPay: 0, totalDeductions: 0, netPay: 0 },
  );

  return {
    year: input.year,
    periodCount: contributions.length,
    grossPay: roundMoney(totals.grossPay),
    totalDeductions: roundMoney(totals.totalDeductions),
    netPay: roundMoney(totals.netPay),
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
