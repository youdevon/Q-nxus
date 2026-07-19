/**
 * Role codes are uppercase identifiers stored on Role.code.
 * Custom roles may omit an explicit code; we slug from the name.
 */

const ROLE_CODE_PATTERN = /^[A-Z0-9_.-]{2,50}$/;

export function isValidRoleCode(code: string): boolean {
  return ROLE_CODE_PATTERN.test(code);
}

/**
 * Derive a role code from a display name.
 * "HR Leave Clerk" → "HR_LEAVE_CLERK"
 */
export function slugifyRoleCode(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 50);

  return slug;
}

/**
 * Resolve the code to persist: prefer explicit input, else slug from name.
 * Returns null when neither yields a valid code.
 */
export function resolveRoleCode(input: {
  code?: string | null;
  name: string;
}): string | null {
  const explicit = input.code?.trim().toUpperCase() ?? "";

  if (explicit) {
    return isValidRoleCode(explicit) ? explicit : null;
  }

  const fromName = slugifyRoleCode(input.name);

  if (!fromName || !isValidRoleCode(fromName)) {
    return null;
  }

  return fromName;
}

/** Built-in role codes seeded by the platform (always isSystem). */
export const BUILT_IN_ROLE_CODES = [
  "SYSTEM_ADMINISTRATOR",
  "EMPLOYEE",
  "LEAVE_APPROVER",
  "HR_CLERK",
  "HR_LEAVE_OFFICER",
  "HR_ADMINISTRATOR",
  "PAYROLL_CLERK",
  "PAYROLL_OFFICER",
  "HR_PAYROLL_ADMINISTRATOR",
] as const;

export type BuiltInRoleCode = (typeof BUILT_IN_ROLE_CODES)[number];

export function isBuiltInRoleCode(code: string): boolean {
  return (BUILT_IN_ROLE_CODES as readonly string[]).includes(code);
}
