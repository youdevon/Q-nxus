/** ISO calendar date `YYYY-MM-DD` (UTC date parts, no time zone shift). */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Fixed-term length presets used by the employment contract form. */
export type ContractLengthPreset = "6M" | "1Y" | "3Y";

export type ContractPeriodOption = ContractLengthPreset | "custom";

const PRESET_ORDER: ContractLengthPreset[] = ["6M", "1Y", "3Y"];

function parseIsoDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  // Reject impossible calendar dates (e.g. 2026-02-30).
  const probe = new Date(Date.UTC(year, month - 1, day));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Add calendar years to an ISO date, clamping the day when the
 * anniversary month is shorter (e.g. Feb 29 → Feb 28).
 */
export function addCalendarYears(
  isoDate: string,
  years: number,
): string | null {
  const parts = parseIsoDate(isoDate);

  if (!parts || !Number.isInteger(years)) {
    return null;
  }

  const year = parts.year + years;
  const day = Math.min(parts.day, daysInMonth(year, parts.month));

  return formatIsoDate(year, parts.month, day);
}

/**
 * Add calendar months to an ISO date, clamping the day when the
 * target month is shorter (e.g. Jan 31 + 1m → Feb 28/29).
 */
export function addCalendarMonths(
  isoDate: string,
  months: number,
): string | null {
  const parts = parseIsoDate(isoDate);

  if (!parts || !Number.isInteger(months)) {
    return null;
  }

  const totalMonths = parts.month - 1 + months;
  const year = parts.year + Math.floor(totalMonths / 12);
  const monthIndex = ((totalMonths % 12) + 12) % 12;
  const month = monthIndex + 1;
  const day = Math.min(parts.day, daysInMonth(year, month));

  return formatIsoDate(year, month, day);
}

/** Subtract one calendar day from an ISO date. */
export function subtractOneCalendarDay(isoDate: string): string | null {
  const parts = parseIsoDate(isoDate);

  if (!parts) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() - 1);

  return formatIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

/** Add one calendar day to an ISO date. */
export function addOneCalendarDay(isoDate: string): string | null {
  const parts = parseIsoDate(isoDate);

  if (!parts) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + 1);

  return formatIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

/**
 * Earliest allowed start date for a renewal: the day after the
 * previous contract’s effective end (termination if closed early,
 * otherwise scheduled end date).
 */
export function earliestRenewalStartDate(previous: {
  endDate: string | null;
  terminationDate: string | null;
  status: string;
}): string | null {
  const closedEarly =
    previous.status === "TERMINATED" ||
    previous.status === "CANCELLED" ||
    Boolean(previous.terminationDate);

  const anchor = closedEarly
    ? (previous.terminationDate ?? previous.endDate)
    : (previous.endDate ?? previous.terminationDate);

  if (!anchor) {
    return null;
  }

  return addOneCalendarDay(anchor);
}

function periodAnniversary(
  startDate: string,
  preset: ContractLengthPreset,
): string | null {
  switch (preset) {
    case "6M":
      return addCalendarMonths(startDate, 6);
    case "1Y":
      return addCalendarYears(startDate, 1);
    case "3Y":
      return addCalendarYears(startDate, 3);
  }
}

/**
 * Contract end date for a fixed period: the day before the
 * period anniversary of the start date.
 *
 * Examples:
 * - 2026-01-01 + 6M → 2026-06-30
 * - 2026-01-01 + 1Y → 2026-12-31
 * - 2026-01-15 + 1Y → 2027-01-14
 * - 2026-03-01 + 1Y → 2027-02-28
 * - 2026-01-01 + 3Y → 2028-12-31
 */
export function calculateContractEndDate(
  startDate: string,
  preset: ContractLengthPreset,
): string | null {
  const anniversary = periodAnniversary(startDate, preset);

  if (!anniversary) {
    return null;
  }

  return subtractOneCalendarDay(anniversary);
}

export function inferContractPeriod(
  startDate: string,
  endDate: string,
): ContractPeriodOption {
  for (const preset of PRESET_ORDER) {
    if (calculateContractEndDate(startDate, preset) === endDate) {
      return preset;
    }
  }

  return "custom";
}
