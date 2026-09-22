/**
 * Employee identity fields used across HR and payroll.
 *
 * NIS/BIR numbers and date of birth live on `hr.employees` only (not PayrollProfile).
 * Payroll may fill empty statutory numbers when the actor has `people.manage`.
 */

/** Prefer the existing stored value; otherwise accept a new value from a form. */
export function resolveStatutoryNumber(
  existingValue: string | null | undefined,
  incomingValue: string | null | undefined,
): string | null {
  const existing = existingValue?.trim() || null;
  if (existing) {
    return existing;
  }

  return incomingValue?.trim() || null;
}
