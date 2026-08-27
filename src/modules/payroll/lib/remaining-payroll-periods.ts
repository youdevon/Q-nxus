/**
 * Remaining payroll periods in a Trinidad & Tobago calendar tax year.
 * Phase 1 of annual PAYE projection: MONTHLY frequency only.
 * Fortnightly / weekly require a full pay-period calendar (later).
 */

export type PayFrequencyCode =
  | "WEEKLY"
  | "FORTNIGHTLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "SEMI_MONTHLY"
  | "ANNUAL";

export type RemainingPayrollPeriodsInput = {
  taxYear: number;
  /** Inclusive as-of date for “periods already completed” (usually last posted period end or today). */
  asOfDate: Date;
  payFrequency: PayFrequencyCode;
  /**
   * When set, projection ends on this date (contract end / termination),
   * not 31 Dec of the tax year.
   */
  employmentEndDate?: Date | null;
  /**
   * When set, months before this hire date in the tax year are excluded
   * (Scenario 3 — mid-year joiner with no prior employment).
   */
  employmentStartDate?: Date | null;
};

export type RemainingPayrollPeriodsResult = {
  taxYear: number;
  payFrequency: PayFrequencyCode;
  periodsPerYear: number;
  periodsElapsed: number;
  remainingPeriods: number;
  projectionEndDate: string;
  asOfDate: string;
  /** True when frequency is not yet supported for non-monthly projection. */
  frequencySupported: boolean;
  notes: string[];
};

function utcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function yearEnd(taxYear: number): Date {
  return new Date(Date.UTC(taxYear, 11, 31));
}

function yearStart(taxYear: number): Date {
  return new Date(Date.UTC(taxYear, 0, 1));
}

function clampDate(value: Date, min: Date, max: Date): Date {
  const t = value.getTime();
  if (t < min.getTime()) {
    return min;
  }
  if (t > max.getTime()) {
    return max;
  }
  return value;
}

/**
 * Count remaining MONTHLY payroll periods after `asOfDate` through projection end.
 * A month whose period end (last day of month) is strictly after asOf counts as remaining.
 */
export function countRemainingMonthlyPeriods(input: {
  taxYear: number;
  asOfDate: Date;
  projectionEndDate: Date;
  /** Exclude month-ends strictly before the hire month. */
  employmentStartDate?: Date | null;
}): { periodsElapsed: number; remainingPeriods: number } {
  const ends = listRemainingMonthlyPeriodEnds(input);
  const start = yearStart(input.taxYear);
  const end = clampDate(
    utcDay(input.projectionEndDate),
    start,
    yearEnd(input.taxYear),
  );
  const asOf = utcDay(input.asOfDate);
  const hire = input.employmentStartDate
    ? employmentStartInTaxYear(input.employmentStartDate, input.taxYear)
    : start;

  let periodsElapsed = 0;
  for (let month = 0; month < 12; month += 1) {
    const periodEnd = new Date(Date.UTC(input.taxYear, month + 1, 0));
    if (periodEnd.getTime() < start.getTime()) {
      continue;
    }
    if (periodEnd.getUTCMonth() < hire.getUTCMonth() &&
        periodEnd.getUTCFullYear() === hire.getUTCFullYear()) {
      continue;
    }
    if (periodEnd.getTime() > end.getTime()) {
      break;
    }
    if (periodEnd.getTime() <= asOf.getTime()) {
      periodsElapsed += 1;
    }
  }

  return {
    periodsElapsed,
    remainingPeriods: ends.length,
  };
}

/**
 * Month-end dates strictly after `asOfDate` through the projection end (inclusive).
 * Used when applying approved annual PAYE projection overrides system-wide.
 */
export function listRemainingMonthlyPeriodEnds(input: {
  taxYear: number;
  asOfDate: Date;
  projectionEndDate: Date;
  employmentStartDate?: Date | null;
}): Date[] {
  const start = yearStart(input.taxYear);
  const end = clampDate(
    utcDay(input.projectionEndDate),
    start,
    yearEnd(input.taxYear),
  );
  const asOf = utcDay(input.asOfDate);
  const hire = input.employmentStartDate
    ? employmentStartInTaxYear(input.employmentStartDate, input.taxYear)
    : start;
  const remaining: Date[] = [];

  for (let month = 0; month < 12; month += 1) {
    const periodEnd = new Date(Date.UTC(input.taxYear, month + 1, 0));
    if (periodEnd.getTime() < start.getTime()) {
      continue;
    }
    if (
      periodEnd.getUTCFullYear() === hire.getUTCFullYear() &&
      periodEnd.getUTCMonth() < hire.getUTCMonth()
    ) {
      continue;
    }
    if (periodEnd.getTime() > end.getTime()) {
      break;
    }
    if (periodEnd.getTime() > asOf.getTime()) {
      remaining.push(periodEnd);
    }
  }

  return remaining;
}

/** Drop period ends that already have a posted payslip (by YYYY-MM-DD key). */
export function filterOpenPeriodEnds(
  periodEnds: Date[],
  postedPeriodEndKeys: Set<string>,
): { open: Date[]; skippedPosted: Date[] } {
  const open: Date[] = [];
  const skippedPosted: Date[] = [];

  for (const periodEnd of periodEnds) {
    if (postedPeriodEndKeys.has(isoDate(periodEnd))) {
      skippedPosted.push(periodEnd);
    } else {
      open.push(periodEnd);
    }
  }

  return { open, skippedPosted };
}

export function resolveRemainingPayrollPeriods(
  input: RemainingPayrollPeriodsInput,
): RemainingPayrollPeriodsResult {
  const notes: string[] = [];
  const start = yearStart(input.taxYear);
  const defaultEnd = yearEnd(input.taxYear);
  let projectionEnd = defaultEnd;

  if (input.employmentEndDate) {
    const end = utcDay(input.employmentEndDate);
    if (end.getUTCFullYear() === input.taxYear && end.getTime() < defaultEnd.getTime()) {
      projectionEnd = end;
      notes.push(
        `Projection ends on employment/contract end ${isoDate(end)} (before year-end).`,
      );
    }
  }

  // Mid-year joiners: do not project (or count elapsed) before employment start.
  let employmentStart = start;
  if (input.employmentStartDate) {
    const hire = utcDay(input.employmentStartDate);
    if (hire.getUTCFullYear() === input.taxYear && hire.getTime() > start.getTime()) {
      employmentStart = hire;
      notes.push(
        `Employment start ${isoDate(hire)} — periods before hire are excluded from the tax-year estimate.`,
      );
    }
  }

  const asOf = clampDate(utcDay(input.asOfDate), employmentStart, projectionEnd);

  if (input.payFrequency !== "MONTHLY") {
    notes.push(
      `${input.payFrequency} remaining-period counts are not fully supported yet; monthly approximation is used for display only.`,
    );

    const monthly = countRemainingMonthlyPeriods({
      taxYear: input.taxYear,
      asOfDate: asOf,
      projectionEndDate: projectionEnd,
      employmentStartDate: employmentStart,
    });

    const periodsPerYear =
      input.payFrequency === "WEEKLY"
        ? 52
        : input.payFrequency === "FORTNIGHTLY" ||
            input.payFrequency === "BIWEEKLY"
          ? 26
          : input.payFrequency === "SEMI_MONTHLY"
            ? 24
            : 12;

    const remainingApprox = Math.max(
      0,
      Math.round((monthly.remainingPeriods / 12) * periodsPerYear),
    );
    const elapsedApprox = Math.max(0, periodsPerYear - remainingApprox);

    return {
      taxYear: input.taxYear,
      payFrequency: input.payFrequency,
      periodsPerYear,
      periodsElapsed: elapsedApprox,
      remainingPeriods: remainingApprox,
      projectionEndDate: isoDate(projectionEnd),
      asOfDate: isoDate(asOf),
      frequencySupported: false,
      notes,
    };
  }

  const monthly = countRemainingMonthlyPeriods({
    taxYear: input.taxYear,
    asOfDate: asOf,
    projectionEndDate: projectionEnd,
    employmentStartDate: employmentStart,
  });

  return {
    taxYear: input.taxYear,
    payFrequency: "MONTHLY",
    periodsPerYear: 12,
    periodsElapsed: monthly.periodsElapsed,
    remainingPeriods: monthly.remainingPeriods,
    projectionEndDate: isoDate(projectionEnd),
    asOfDate: isoDate(asOf),
    frequencySupported: true,
    notes,
  };
}

/**
 * Clamp hire date into the tax year (Jan 1 if hired earlier / unknown year).
 */
export function employmentStartInTaxYear(
  hireDate: Date | null | undefined,
  taxYear: number,
): Date {
  const start = yearStart(taxYear);
  if (!hireDate) {
    return start;
  }
  const hire = utcDay(hireDate);
  if (hire.getUTCFullYear() < taxYear) {
    return start;
  }
  if (hire.getUTCFullYear() > taxYear) {
    return start;
  }
  return hire.getTime() > start.getTime() ? hire : start;
}

/**
 * Employment-aware monthly period counts for live PAYE.
 * Periods before the hire month in the tax year are excluded (Scenario 3).
 */
export function countEmploymentMonthlyPeriods(input: {
  taxYear: number;
  employmentStartDate: Date | null | undefined;
  employmentEndDate?: Date | null;
  /** Current payroll period end (inclusive in elapsed). */
  periodEnd: Date;
}): {
  employmentStartUsed: string | null;
  periodsInEmploymentYear: number;
  periodsElapsedIncludingThis: number;
  remainingPeriodsAfterThis: number;
  remainingPeriodsIncludingThis: number;
} {
  const yearFinish = yearEnd(input.taxYear);
  const hire = employmentStartInTaxYear(input.employmentStartDate, input.taxYear);
  let projectionEnd = yearFinish;
  if (input.employmentEndDate) {
    const end = utcDay(input.employmentEndDate);
    if (
      end.getUTCFullYear() === input.taxYear &&
      end.getTime() < yearFinish.getTime()
    ) {
      projectionEnd = end;
    }
  }

  const periodEnd = utcDay(input.periodEnd);
  let periodsInEmploymentYear = 0;
  let periodsElapsedIncludingThis = 0;
  let remainingPeriodsAfterThis = 0;

  for (let month = 0; month < 12; month += 1) {
    if (month < hire.getUTCMonth()) {
      continue;
    }
    const end = new Date(Date.UTC(input.taxYear, month + 1, 0));
    if (end.getTime() > projectionEnd.getTime()) {
      break;
    }

    periodsInEmploymentYear += 1;
    if (end.getTime() <= periodEnd.getTime()) {
      periodsElapsedIncludingThis += 1;
    } else {
      remainingPeriodsAfterThis += 1;
    }
  }

  if (periodsElapsedIncludingThis < 1) {
    periodsElapsedIncludingThis = 1;
  }
  if (periodsInEmploymentYear < 1) {
    periodsInEmploymentYear = 1;
  }

  return {
    employmentStartUsed:
      input.employmentStartDate != null ? isoDate(hire) : null,
    periodsInEmploymentYear,
    periodsElapsedIncludingThis,
    remainingPeriodsAfterThis,
    remainingPeriodsIncludingThis: remainingPeriodsAfterThis + 1,
  };
}
