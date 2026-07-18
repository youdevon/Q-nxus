/**
 * Employee identity / statutory numbers are the source of truth.
 * PayrollProfile.nisNumber / birNumber remain as a mirrored copy for
 * payslip snapshots and historical readiness checks. Prefer employee,
 * then fall back to profile (legacy rows not yet backfilled).
 */
export function resolveStatutoryNumber(
  employeeValue: string | null | undefined,
  profileValue: string | null | undefined,
): string | null {
  const fromEmployee = employeeValue?.trim() || null;
  if (fromEmployee) {
    return fromEmployee;
  }

  const fromProfile = profileValue?.trim() || null;
  return fromProfile;
}
