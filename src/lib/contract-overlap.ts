/**
 * Pure helpers for employment-contract date non-overlap rules.
 * Dates are ISO calendar strings `YYYY-MM-DD`.
 */

export type ContractDateRange = {
  startDate: string;
  endDate: string | null;
};

/**
 * Inclusive ranges overlap when each starts on or before the other's end.
 * A null end date is treated as open-ended (still active).
 */
export function contractRangesOverlap(
  a: ContractDateRange,
  b: ContractDateRange,
): boolean {
  const aEnd = a.endDate ?? "9999-12-31";
  const bEnd = b.endDate ?? "9999-12-31";

  return a.startDate <= bEnd && b.startDate <= aEnd;
}

/**
 * Renewal / extension starts the day after the previous effective end,
 * so the new range must not overlap the previous one.
 */
export function renewalOverlapsPrevious(args: {
  previousEndDate: string | null;
  previousTerminationDate: string | null;
  previousStatus: string;
  renewalStartDate: string;
}): boolean {
  const closedEarly =
    args.previousStatus === "TERMINATED" ||
    args.previousStatus === "CANCELLED" ||
    Boolean(args.previousTerminationDate);

  const previousEnd = closedEarly
    ? (args.previousTerminationDate ?? args.previousEndDate)
    : (args.previousEndDate ?? args.previousTerminationDate);

  if (!previousEnd) {
    return false;
  }

  return args.renewalStartDate <= previousEnd;
}
