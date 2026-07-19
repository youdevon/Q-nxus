/**
 * Leave request number for audit free-text, or null when unavailable.
 * Never falls back to an opaque database id.
 */
export function leaveRequestAuditRef(
  requestNumber: string | null | undefined,
): string | null {
  const trimmed = requestNumber?.trim();
  return trimmed || null;
}

/** Leading-space number suffix, or empty string when no number. */
export function leaveRequestAuditSuffix(
  requestNumber: string | null | undefined,
): string {
  const ref = leaveRequestAuditRef(requestNumber);
  return ref ? ` ${ref}` : "";
}
