const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseUtcDateParts(
  value: Date | string,
): { year: number; month: number; day: number } | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const match = ISO_DATE.exec(value.slice(0, 10));

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
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

export function ageFromDateOfBirth(
  dateOfBirth: Date | string | null | undefined,
  asOf: Date = new Date(),
): number | null {
  if (!dateOfBirth || Number.isNaN(asOf.getTime())) {
    return null;
  }

  const birth = parseUtcDateParts(dateOfBirth);

  if (!birth) {
    return null;
  }

  let age = asOf.getUTCFullYear() - birth.year;
  const monthDelta = asOf.getUTCMonth() + 1 - birth.month;
  const dayDelta = asOf.getUTCDate() - birth.day;

  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
