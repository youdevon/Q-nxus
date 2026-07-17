type DateLike = Date | string | null | undefined;

function toUtcNoon(value: DateLike): Date | null {
  if (!value) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
}

function inclusiveCalendarDays(start: Date, end: Date): number {
  const msPerDay = 86_400_000;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
}

export function calculateCalendarOverlapDays(input: {
  periodStart: Date;
  periodEnd: Date;
  startDate?: DateLike;
  endDate?: DateLike;
}): number {
  const periodStart = toUtcNoon(input.periodStart);
  const periodEnd = toUtcNoon(input.periodEnd);

  if (!periodStart || !periodEnd || periodStart.getTime() > periodEnd.getTime()) {
    return 0;
  }

  const startDate = toUtcNoon(input.startDate);
  const endDate = toUtcNoon(input.endDate);
  const effectiveStart =
    startDate && startDate.getTime() > periodStart.getTime()
      ? startDate
      : periodStart;
  const effectiveEnd =
    endDate && endDate.getTime() < periodEnd.getTime() ? endDate : periodEnd;

  if (effectiveStart.getTime() > effectiveEnd.getTime()) {
    return 0;
  }

  return inclusiveCalendarDays(effectiveStart, effectiveEnd);
}

export function calculateCalendarProration(input: {
  periodStart: Date;
  periodEnd: Date;
  employeeHireDate?: DateLike;
  employeeTerminationDate?: DateLike;
  contractStartDate?: DateLike;
  contractEndDate?: DateLike;
  contractTerminationDate?: DateLike;
}): {
  periodDays: number;
  workedDays: number;
  factor: number;
  detail: string | null;
} {
  const periodDays = calculateCalendarOverlapDays({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  const starts = [input.employeeHireDate, input.contractStartDate]
    .map(toUtcNoon)
    .filter((date): date is Date => Boolean(date));
  const ends = [
    input.employeeTerminationDate,
    input.contractEndDate,
    input.contractTerminationDate,
  ]
    .map(toUtcNoon)
    .filter((date): date is Date => Boolean(date));

  const startDate = starts.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const endDate = ends.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const workedDays = calculateCalendarOverlapDays({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    startDate,
    endDate,
  });
  const factor = periodDays > 0 ? Math.round((workedDays / periodDays) * 10000) / 10000 : 0;

  return {
    periodDays,
    workedDays,
    factor,
    detail:
      factor > 0 && factor < 1
        ? `Pro-rated by calendar days worked: ${workedDays}/${periodDays}`
        : null,
  };
}

export function prorateMoney(amount: number, factor: number): number {
  return Math.round(amount * factor * 100) / 100;
}
