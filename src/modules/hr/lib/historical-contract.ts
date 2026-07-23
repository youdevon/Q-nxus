function startOfUtcDay(value = new Date()): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

/**
 * True when the contract's end date is strictly before today (UTC).
 * Used for paper cutover: past terms are recorded as EXPIRED history.
 */
export function isHistoricalEndedContract(endDate: Date | null): boolean {
  if (!endDate) {
    return false;
  }

  return endDate.getTime() < startOfUtcDay().getTime();
}
