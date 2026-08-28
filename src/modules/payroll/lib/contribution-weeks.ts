/**
 * Trinidad & Tobago statutory contribution weeks = Mondays in the pay period.
 * Uses date-only UTC midday (matches payroll period bounds elsewhere).
 */

function toUtcNoon(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
}

/**
 * Count Mondays whose calendar date falls within [periodStart, periodEnd]
 * inclusive (date-only).
 */
export function countMondaysInRange(periodStart: Date, periodEnd: Date): number {
  const start = toUtcNoon(periodStart);
  const end = toUtcNoon(periodEnd);

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  const firstMonday = new Date(start);
  const daysUntilMonday = (8 - firstMonday.getUTCDay()) % 7;
  firstMonday.setUTCDate(firstMonday.getUTCDate() + daysUntilMonday);

  let weeks = 0;
  for (
    const cursor = firstMonday;
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  ) {
    weeks += 1;
  }

  return weeks;
}

/** Count Mondays in a calendar month (`month` is 1–12). */
export function countMondaysInMonth(year: number, month: number): number {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return 0;
  }

  const periodStart = new Date(Date.UTC(year, month - 1, 1, 12));
  const periodEnd = new Date(Date.UTC(year, month, 0, 12));
  return countMondaysInRange(periodStart, periodEnd);
}
