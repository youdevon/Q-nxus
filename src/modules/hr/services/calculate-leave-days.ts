import { Prisma } from "@/generated/prisma/client";

export type CalculatedLeaveDay = {
  leaveDate: Date;
  quantity: Prisma.Decimal;
  isWorkingDay: boolean;
  isPublicHoliday: boolean;
};

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function toIsoDate(value: Date): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

/**
 * Count leave days between inclusive start/end.
 * Weekends (Sat/Sun) and organization holidays are non-working.
 */
export function calculateLeaveDays({
  startDate,
  endDate,
  holidayDates = [],
}: {
  startDate: Date;
  endDate: Date;
  /** ISO `YYYY-MM-DD` holiday dates (UTC calendar). */
  holidayDates?: string[];
}): {
  days: CalculatedLeaveDay[];
  requestedQuantity: Prisma.Decimal;
} {
  const start = startOfUtcDay(startDate);
  const end = startOfUtcDay(endDate);
  const holidays = new Set(holidayDates);

  if (end < start) {
    throw new Error("Leave end date cannot be before the start date.");
  }

  const days: CalculatedLeaveDay[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const dayOfWeek = cursor.getUTCDay();
    const iso = toIsoDate(cursor);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isPublicHoliday = holidays.has(iso);
    const isWorkingDay = !isWeekend && !isPublicHoliday;

    days.push({
      leaveDate: new Date(cursor),
      quantity: new Prisma.Decimal(isWorkingDay ? 1 : 0),
      isWorkingDay,
      isPublicHoliday,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const requestedQuantity = days.reduce(
    (total, day) => total.plus(day.quantity),
    new Prisma.Decimal(0),
  );

  return {
    days,
    requestedQuantity,
  };
}
