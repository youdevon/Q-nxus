/**
 * Pure rules for mandatory vacation that cannot roll over to a new contract.
 *
 * Trigger: days until contract end ≤ {@link VACATION_FORFEITURE_NOTICE_DAYS}
 * (including already-ended contracts) AND available VAC balance > 0.
 * Approved / reserved leave is already scheduled or pending — only unused
 * available days are treated as at risk of forfeiture.
 */

export const VACATION_LEAVE_TYPE_CODE = "VAC";
export const VACATION_FORFEITURE_NOTICE_DAYS = 30;

/** Stable notification title used for dedupe. */
export const VACATION_FORFEITURE_NOTIFICATION_TITLE =
  "Unused vacation must be taken by contract end";

export type VacationForfeitureAlert = {
  daysUntilEnd: number;
  availableDays: number;
  contractEndDateIso: string;
  /** true when the contract end date is today or already past */
  isUrgent: boolean;
};

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function utcCalendarDaysUntil(
  from: Date,
  to: Date,
): number {
  const fromDay = startOfUtcDay(from).getTime();
  const toDay = startOfUtcDay(to).getTime();

  return Math.round((toDay - fromDay) / (1000 * 60 * 60 * 24));
}

export function isWithinVacationForfeitureWindow(
  daysUntilEnd: number,
  noticeDays: number = VACATION_FORFEITURE_NOTICE_DAYS,
): boolean {
  return daysUntilEnd <= noticeDays;
}

export function parseAvailableVacationDays(
  availableBalance: string | number,
): number {
  const value =
    typeof availableBalance === "number"
      ? availableBalance
      : Number(availableBalance);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

export function hasForfeitableAvailableVacation(
  availableBalance: string | number,
): boolean {
  return parseAvailableVacationDays(availableBalance) > 0;
}

/**
 * Returns an alert payload when remaining available vacation would be lost
 * because the contract ends within the notice window (or has already ended).
 * Contracts with no end date never forfeit under this rule.
 */
export function evaluateVacationForfeitureAlert(input: {
  availableVacation: string | number;
  contractEndDate: Date | null | undefined;
  asOf?: Date;
  noticeDays?: number;
}): VacationForfeitureAlert | null {
  const { contractEndDate } = input;

  if (!contractEndDate) {
    return null;
  }

  const availableDays = parseAvailableVacationDays(input.availableVacation);

  if (availableDays <= 0) {
    return null;
  }

  const asOf = input.asOf ?? new Date();
  const daysUntilEnd = utcCalendarDaysUntil(asOf, contractEndDate);
  const noticeDays = input.noticeDays ?? VACATION_FORFEITURE_NOTICE_DAYS;

  if (!isWithinVacationForfeitureWindow(daysUntilEnd, noticeDays)) {
    return null;
  }

  return {
    daysUntilEnd,
    availableDays,
    contractEndDateIso: startOfUtcDay(contractEndDate)
      .toISOString()
      .slice(0, 10),
    isUrgent: daysUntilEnd <= 0,
  };
}

export function formatVacationForfeitureMessage(
  alert: VacationForfeitureAlert,
  options?: { employeeName?: string },
): string {
  const daysLabel = Number.isInteger(alert.availableDays)
    ? String(alert.availableDays)
    : String(Number(alert.availableDays.toFixed(2)));

  const forOther = Boolean(options?.employeeName);
  const subject = forOther
    ? `${options!.employeeName} still has ${daysLabel} day(s) of available vacation`
    : `You still have ${daysLabel} day(s) of available vacation`;
  const contractPossessive = forOther ? "Their contract" : "Your contract";
  const schedulePhrase = forOther
    ? "Schedule leave so it finishes on or before the contract end date"
    : "Schedule leave so it finishes on or before the contract end date";

  if (alert.daysUntilEnd < 0) {
    return `${subject}. Vacation cannot roll over to a new contract — unused days ending ${alert.contractEndDateIso} may already be forfeited. ${schedulePhrase}.`;
  }

  if (alert.daysUntilEnd === 0) {
    return `${subject}. Vacation cannot roll over to a new contract — take it by today's contract end date (${alert.contractEndDateIso}). Leave must finish on or before that date.`;
  }

  return `${subject}. ${contractPossessive} ends on ${alert.contractEndDateIso} (${alert.daysUntilEnd} day(s) left). Vacation cannot roll over — ${schedulePhrase.charAt(0).toLowerCase()}${schedulePhrase.slice(1)}.`;
}
