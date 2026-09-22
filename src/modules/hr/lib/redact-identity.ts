/**
 * Audit / log safe identity: last four only (or null when empty).
 * Use for NIS, BIR, national ID — never persist this form as the source of truth.
 */
export function redactIdentityForAudit(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return `••••${trimmed.slice(-4)}`;
}

/** Mask known statutory identity keys in audit JSON payloads. */
export function redactIdentityFieldsInRecord(
  record: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!record) {
    return null;
  }

  const keys = ["nisNumber", "birNumber", "idNumber"] as const;
  const next: Record<string, unknown> = { ...record };
  for (const key of keys) {
    if (key in next && typeof next[key] === "string") {
      next[key] = redactIdentityForAudit(next[key] as string);
    }
  }
  return next;
}
