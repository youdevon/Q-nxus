/**
 * Continuous employment coverage for PAYE sticky overrides / projection windows.
 *
 * - Mid-month contract end (no successor) → that calendar month needs manual PAYE
 * - Successor that starts on or before the day after prior end → treat as unbroken
 */

export type EmploymentContractSpan = {
  id: string;
  startDate: Date;
  endDate: Date | null;
  terminationDate?: Date | null;
  sourceContractId?: string | null;
  status?: string;
  isCurrent?: boolean;
};

export type ContinuousEmploymentEndResult = {
  /** Effective employment end for remaining-period / sticky PAYE windows. Null = open-ended. */
  endDate: Date | null;
  /** True when more than one contract span was merged without a gap. */
  continuous: boolean;
  /** True when the resolved end falls mid-month (manual PAYE month). */
  midMonthEnd: boolean;
  /** Contracts included in the continuous chain (ids). */
  chainContractIds: string[];
};

function utcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number): Date {
  const day = utcDay(value);
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + days),
  );
}

/** Last calendar day of the month containing `value` (UTC). */
export function monthEndUtc(value: Date): Date {
  const day = utcDay(value);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0));
}

export function isLastDayOfMonth(value: Date): boolean {
  return utcDay(value).getTime() === monthEndUtc(value).getTime();
}

/** True when the date is not the last day of its month. */
export function isMidMonthCalendarEnd(
  value: Date | null | undefined,
): boolean {
  if (!value) {
    return false;
  }
  return !isLastDayOfMonth(value);
}

function contractEffectiveEnd(contract: EmploymentContractSpan): Date | null {
  if (contract.terminationDate) {
    return utcDay(contract.terminationDate);
  }
  if (contract.endDate) {
    return utcDay(contract.endDate);
  }
  return null;
}

/**
 * Whether sticky / projection auto-apply should skip PAYE for this period end
 * because employment ends mid-month inside that period (manual entry required).
 */
export function shouldSkipPayeAutoApplyForPeriod(input: {
  periodEnd: Date;
  employmentEndDate: Date | null | undefined;
}): boolean {
  const employmentEnd = input.employmentEndDate
    ? utcDay(input.employmentEndDate)
    : null;
  if (!employmentEnd || !isMidMonthCalendarEnd(employmentEnd)) {
    return false;
  }
  return (
    utcDay(input.periodEnd).getTime() === monthEndUtc(employmentEnd).getTime()
  );
}

/**
 * Resolve the furthest continuous employment end from contract spans.
 * Gaps of 1+ calendar days break continuity. Overlap or abut (next start ≤
 * prior end + 1 day) keeps the chain open.
 */
export function resolveContinuousEmploymentEnd(input: {
  contracts: EmploymentContractSpan[];
  employeeTerminationDate?: Date | null;
  /** Prefer chains covering this date when multiple disjoint spans exist. */
  asOf?: Date | null;
}): ContinuousEmploymentEndResult {
  if (input.employeeTerminationDate) {
    const end = utcDay(input.employeeTerminationDate);
    return {
      endDate: end,
      continuous: false,
      midMonthEnd: isMidMonthCalendarEnd(end),
      chainContractIds: [],
    };
  }

  const sorted = [...input.contracts]
    .map((contract) => ({
      ...contract,
      startDate: utcDay(contract.startDate),
      endDate: contract.endDate ? utcDay(contract.endDate) : null,
      terminationDate: contract.terminationDate
        ? utcDay(contract.terminationDate)
        : null,
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  if (sorted.length === 0) {
    return {
      endDate: null,
      continuous: false,
      midMonthEnd: false,
      chainContractIds: [],
    };
  }

  const asOf = input.asOf ? utcDay(input.asOf) : null;

  // Prefer the chain that covers asOf / current contract; else earliest chain.
  let startIndex = 0;
  if (asOf) {
    const covering = sorted.findIndex((contract) => {
      const end = contractEffectiveEnd(contract);
      return (
        contract.startDate.getTime() <= asOf.getTime() &&
        (end == null || end.getTime() >= asOf.getTime())
      );
    });
    if (covering >= 0) {
      startIndex = covering;
    } else {
      const currentIdx = sorted.findIndex((contract) => contract.isCurrent);
      if (currentIdx >= 0) {
        startIndex = currentIdx;
      }
    }
  } else {
    const currentIdx = sorted.findIndex((contract) => contract.isCurrent);
    if (currentIdx >= 0) {
      startIndex = currentIdx;
    }
  }

  const chain: EmploymentContractSpan[] = [sorted[startIndex]!];
  let coverageEnd = contractEffectiveEnd(sorted[startIndex]!);

  // Walk forward merging contiguous / overlapping successors.
  for (let i = startIndex + 1; i < sorted.length; i += 1) {
    const next = sorted[i]!;
    if (coverageEnd == null) {
      // Open-ended prior already covers everything after.
      chain.push(next);
      continue;
    }
    const latestStartAllowed = addUtcDays(coverageEnd, 1);
    if (next.startDate.getTime() > latestStartAllowed.getTime()) {
      break;
    }
    chain.push(next);
    const nextEnd = contractEffectiveEnd(next);
    if (nextEnd == null) {
      coverageEnd = null;
    } else if (nextEnd.getTime() > coverageEnd.getTime()) {
      coverageEnd = nextEnd;
    }
  }

  // Also walk backward if asOf chain started mid-sequence (e.g. amendment).
  for (let i = startIndex - 1; i >= 0; i -= 1) {
    const prev = sorted[i]!;
    const prevEnd = contractEffectiveEnd(prev);
    const first = chain[0]!;
    if (prevEnd == null) {
      chain.unshift(prev);
      continue;
    }
    const latestStartAllowed = addUtcDays(prevEnd, 1);
    if (first.startDate.getTime() > latestStartAllowed.getTime()) {
      break;
    }
    chain.unshift(prev);
  }

  // Recompute coverage end from full chain.
  coverageEnd = null;
  for (const contract of chain) {
    const end = contractEffectiveEnd(contract);
    if (end == null) {
      coverageEnd = null;
      break;
    }
    if (coverageEnd == null || end.getTime() > coverageEnd.getTime()) {
      coverageEnd = end;
    }
  }

  return {
    endDate: coverageEnd,
    continuous: chain.length > 1,
    midMonthEnd: isMidMonthCalendarEnd(coverageEnd),
    chainContractIds: chain.map((contract) => contract.id),
  };
}

export function describeContinuousEmploymentEnd(
  result: ContinuousEmploymentEndResult,
): string {
  if (result.endDate == null) {
    return result.continuous
      ? "Continuous employment (open-ended) across successive contracts."
      : "Open-ended employment.";
  }
  const end = isoDate(result.endDate);
  if (result.continuous) {
    return result.midMonthEnd
      ? `Continuous employment through ${end} (mid-month end — final month PAYE is manual).`
      : `Continuous employment through ${end}.`;
  }
  return result.midMonthEnd
    ? `Employment ends ${end} (mid-month — that month’s PAYE is not auto-applied).`
    : `Employment ends ${end}.`;
}
