/**
 * Monthly payroll period helpers (Trinidad calendar month default).
 * Frequency stays flexible for future non-monthly periods.
 */

import {
  formatPayslipPeriodLabel,
  payslipPeriodToAsOfDate,
} from "@/src/modules/payroll/lib/payslip-preview";

const PERIOD_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type MonthlyPeriodBounds = {
  periodKey: string;
  year: number;
  month: number;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  asOf: Date;
};

export function parseMonthlyPeriodKey(
  periodKey: string | null | undefined,
): { year: number; month: number } | null {
  const match = periodKey?.trim().match(PERIOD_KEY_PATTERN);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

export function buildMonthlyPeriodBounds(
  periodKey: string,
): MonthlyPeriodBounds | null {
  const parsed = parseMonthlyPeriodKey(periodKey);

  if (!parsed) {
    return null;
  }

  const { year, month } = parsed;
  const asOf = payslipPeriodToAsOfDate(periodKey);

  if (!asOf) {
    return null;
  }

  const periodStart = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const periodEnd = asOf;
  const name =
    formatPayslipPeriodLabel(periodKey) ??
    `${year}-${String(month).padStart(2, "0")}`;

  return {
    periodKey,
    year,
    month,
    name,
    periodStart,
    periodEnd,
    asOf,
  };
}

export function defaultMonthlyPeriodKey(referenceDate = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-TT", {
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Port_of_Spain",
  }).formatToParts(referenceDate);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  return `${year}-${String(month).padStart(2, "0")}`;
}
