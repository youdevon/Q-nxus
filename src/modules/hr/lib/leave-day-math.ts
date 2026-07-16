/**
 * Client-safe leave day counting. No Prisma / generated client imports.
 * Weekends (Sat/Sun) and organization holidays are non-working.
 */

/** Pure working-day count for client previews. */
export function countWorkingDaysInclusive(
  startIso: string,
  endIso: string,
  holidayDates: string[] = [],
): number {
  if (!startIso || !endIso || endIso < startIso) {
    return 0;
  }

  const holidays = new Set(holidayDates);
  let count = 0;
  const cursor = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);

  while (cursor <= end) {
    const dayOfWeek = cursor.getUTCDay();
    const iso = cursor.toISOString().slice(0, 10);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.has(iso);

    if (!isWeekend && !isHoliday) {
      count += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}
