/**
 * Stable title used for employee-file missing-document reminder dedupe.
 */
export const MISSING_FILE_REMINDER_NOTIFICATION_TITLE =
  "Your employee file is incomplete";

export const MISSING_FILE_REMINDER_DEDUPE_DAYS = 14;

export function buildMissingFileReminderMessage(missingLabels: string[]): string {
  const list =
    missingLabels.length > 0
      ? missingLabels.join(", ")
      : "one or more required documents";

  return `Your employee file is missing: ${list}. Please upload or complete these items via My documents, or contact HR.`;
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
