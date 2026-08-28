/**
 * Effective-dated statutory schedule helpers (PAYE / NIS / Health).
 * Config selection for payroll calc must use the pay period date, not "today".
 */

/** UTC calendar date `YYYY-MM-DD` from a Date or already-normalized string. */
export function toStatutoryAsOfKey(value: Date | string): string {
  if (typeof value === "string") {
    const trimmed = value.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error(`Invalid statutory as-of date: ${value}`);
    }
    return trimmed;
  }

  if (Number.isNaN(value.getTime())) {
    throw new Error("Invalid statutory as-of Date.");
  }

  return value.toISOString().slice(0, 10);
}

/** UTC midnight Date for Prisma `@db.Date` comparisons. */
export function toStatutoryAsOfDate(value: Date | string): Date {
  const key = toStatutoryAsOfKey(value);
  return new Date(`${key}T00:00:00.000Z`);
}

/**
 * Whether an active schedule covers `asOf` (inclusive effectiveFrom / effectiveTo).
 * Dates are compared as `YYYY-MM-DD` strings (UTC calendar days).
 */
export function statutoryScheduleCoversAsOf(input: {
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  asOf: string;
}): boolean {
  if (!input.isActive) {
    return false;
  }

  if (input.effectiveFrom > input.asOf) {
    return false;
  }

  if (input.effectiveTo != null && input.effectiveTo < input.asOf) {
    return false;
  }

  return true;
}

/** Calendar tax year from an as-of key (Trinidad PAYE uses calendar year). */
export function taxYearFromAsOfKey(asOfKey: string): number {
  const year = Number(asOfKey.slice(0, 4));
  if (!Number.isFinite(year)) {
    throw new Error(`Invalid tax year in as-of key: ${asOfKey}`);
  }
  return year;
}
