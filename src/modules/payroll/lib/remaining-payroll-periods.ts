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
}): { periodsElapsed: number; remainingPeriods: number } {
  const ends = listRemainingMonthlyPeriodEnds(input);
  const start = yearStart(input.taxYear);
  const end = clampDate(
    utcDay(input.projectionEndDate),
    start,
    yearEnd(input.taxYear),
  );
  const asOf = utcDay(input.asOfDate);

  let periodsElapsed = 0;
  for (let month = 0; month < 12; month += 1) {
    const periodEnd = new Date(Date.UTC(input.taxYear, month + 1, 0));
    if (periodEnd.getTime() < start.getTime()) {
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
}): Date[] {
  const start = yearStart(input.taxYear);
  const end = clampDate(
    utcDay(input.projectionEndDate),
    start,
    yearEnd(input.taxYear),
  );
  const asOf = utcDay(input.asOfDate);
  const remaining: Date[] = [];

  for (let month = 0; month < 12; month += 1) {
    const periodEnd = new Date(Date.UTC(input.taxYear, month + 1, 0));
    if (periodEnd.getTime() < start.getTime()) {
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

  const asOf = clampDate(utcDay(input.asOfDate), start, projectionEnd);

  if (input.payFrequency !== "MONTHLY") {
    notes.push(
      `${input.payFrequency} remaining-period counts are not fully supported yet; monthly approximation is used for display only.`,
    );

    // Approximate: treat month count as remaining months for unsupported frequencies.
    const monthly = countRemainingMonthlyPeriods({
      taxYear: input.taxYear,
      asOfDate: asOf,
      projectionEndDate: projectionEnd,
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
