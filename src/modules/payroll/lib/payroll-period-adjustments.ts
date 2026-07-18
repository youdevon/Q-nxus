type DateLike = Date | string | null | undefined;
import { roundToCents } from "@/src/modules/payroll/lib/money";

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
  return roundToCents(amount * factor);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
      12,
    ),
  );
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function effectiveContractEnd(contract: {
  endDate?: DateLike;
  terminationDate?: DateLike;
}): Date | null {
  const ends = [contract.endDate, contract.terminationDate]
    .map(toUtcNoon)
    .filter((date): date is Date => Boolean(date));

  if (ends.length === 0) {
    return null;
  }

  return ends.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

export type ContractPaySegmentInput = {
  id: string;
  isCurrent: boolean;
  status: string;
  startDate: DateLike;
  endDate?: DateLike;
  terminationDate?: DateLike;
  baseSalary: number;
  jobTitle: string;
  currency: string;
  allowances: Array<{
    label: string;
    amount: number;
    frequency: string;
    isTaxable: boolean;
  }>;
};

export type ContractPaySegment = {
  contractId: string;
  jobTitle: string;
  currency: string;
  baseSalary: number;
  allowances: ContractPaySegmentInput["allowances"];
  startDate: string;
  endDate: string;
  days: number;
  factor: number;
  detail: string | null;
};

/**
 * Split a pay period across the current contract plus any prior SUPERSEDED
 * contracts that still cover days before the current contract starts.
 *
 * Superseded rows that fully overlap the current contract are ignored so an
 * old overlapping amendment cannot double-count or replace current rates.
 */
export function resolveContractPaySegments(input: {
  periodStart: Date;
  periodEnd: Date;
  employeeHireDate?: DateLike;
  employeeTerminationDate?: DateLike;
  contracts: ContractPaySegmentInput[];
}): {
  periodDays: number;
  workedDays: number;
  segments: ContractPaySegment[];
  detail: string | null;
} {
  const periodDays = calculateCalendarOverlapDays({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  const employment = calculateCalendarProration({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    employeeHireDate: input.employeeHireDate,
    employeeTerminationDate: input.employeeTerminationDate,
  });

  if (periodDays <= 0 || employment.workedDays <= 0) {
    return {
      periodDays,
      workedDays: 0,
      segments: [],
      detail:
        periodDays > 0
          ? "No calendar days worked in this period for the employee hire/termination window."
          : null,
    };
  }

  const employmentStart = toUtcNoon(input.periodStart)!;
  const employmentEnd = toUtcNoon(input.periodEnd)!;
  const hire = toUtcNoon(input.employeeHireDate);
  const termination = toUtcNoon(input.employeeTerminationDate);
  const windowStart =
    hire && hire.getTime() > employmentStart.getTime() ? hire : employmentStart;
  const windowEnd =
    termination && termination.getTime() < employmentEnd.getTime()
      ? termination
      : employmentEnd;

  const eligible = input.contracts.filter(
    (contract) =>
      contract.status === "ACTIVE" || contract.status === "SUPERSEDED",
  );

  const current =
    eligible.find(
      (contract) => contract.isCurrent && contract.status === "ACTIVE",
    ) ?? null;

  const segments: ContractPaySegment[] = [];

  const pushSegment = (
    contract: ContractPaySegmentInput,
    rangeStart: Date,
    rangeEnd: Date,
  ) => {
    const contractStart = toUtcNoon(contract.startDate);
    if (!contractStart) {
      return;
    }
    const contractEnd = effectiveContractEnd(contract);
    const start =
      rangeStart.getTime() > contractStart.getTime()
        ? rangeStart
        : contractStart;
    const end =
      contractEnd && contractEnd.getTime() < rangeEnd.getTime()
        ? contractEnd
        : rangeEnd;

    if (start.getTime() > end.getTime()) {
      return;
    }

    const days = inclusiveCalendarDays(start, end);
    if (days <= 0) {
      return;
    }

    const factor =
      periodDays > 0 ? Math.round((days / periodDays) * 10000) / 10000 : 0;

    segments.push({
      contractId: contract.id,
      jobTitle: contract.jobTitle,
      currency: contract.currency,
      baseSalary: contract.baseSalary,
      allowances: contract.allowances,
      startDate: isoDay(start),
      endDate: isoDay(end),
      days,
      factor,
      detail:
        factor > 0 && factor < 1
          ? `Pro-rated by calendar days worked: ${days}/${periodDays}`
          : null,
    });
  };

  if (current) {
    pushSegment(current, windowStart, windowEnd);

    const currentStart = toUtcNoon(current.startDate);
    if (currentStart && currentStart.getTime() > windowStart.getTime()) {
      const gapEnd = addUtcDays(currentStart, -1);
      if (gapEnd.getTime() >= windowStart.getTime()) {
        const priors = eligible
          .filter((contract) => contract.id !== current.id)
          .filter((contract) => {
            const start = toUtcNoon(contract.startDate);
            if (!start || start.getTime() >= currentStart.getTime()) {
              return false;
            }
            const end = effectiveContractEnd(contract);
            return !end || end.getTime() >= windowStart.getTime();
          })
          .sort((a, b) => {
            const aStart = toUtcNoon(a.startDate)?.getTime() ?? 0;
            const bStart = toUtcNoon(b.startDate)?.getTime() ?? 0;
            if (aStart !== bStart) {
              return bStart - aStart;
            }
            return a.id < b.id ? 1 : -1;
          });

        // Cover the pre-current gap with the latest prior that started before
        // the current contract — never reuse a superseded row that starts on/after
        // the current contract (overlapping amendment noise).
        const prior = priors[0] ?? null;
        if (prior) {
          pushSegment(prior, windowStart, gapEnd);
        }
      }
    }
  } else {
    const historical = [...eligible].sort((a, b) => {
      const aStart = toUtcNoon(a.startDate)?.getTime() ?? 0;
      const bStart = toUtcNoon(b.startDate)?.getTime() ?? 0;
      if (aStart !== bStart) {
        return bStart - aStart;
      }
      return a.id < b.id ? 1 : -1;
    });
    const prior = historical[0] ?? null;
    if (prior) {
      pushSegment(prior, windowStart, windowEnd);
    }
  }

  const workedDays = segments.reduce((sum, segment) => sum + segment.days, 0);
  const detail =
    segments.length === 1
      ? segments[0]?.detail ?? null
      : segments.length > 1
        ? `Split across ${segments.length} contract segments (${workedDays}/${periodDays} days).`
        : employment.workedDays > 0
          ? "No active or superseded contract covers this pay period."
          : null;

  return {
    periodDays,
    workedDays,
    segments: segments.sort((a, b) => a.startDate.localeCompare(b.startDate)),
    detail,
  };
}
