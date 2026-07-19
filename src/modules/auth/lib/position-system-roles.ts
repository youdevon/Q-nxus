/**
 * Roles selectable on a Position as systemRoleCode.
 * Holders receive the role in addition to employee self-service.
 *
 * SYSTEM_ADMINISTRATOR and other identity.role.manage-gated roles are
 * intentionally excluded — those must be assigned via Access admin only.
 */

/** Codes that must never be granted via Position.systemRoleCode / role sync. */
export const POSITION_ROLE_BLOCKLIST = [
  "SYSTEM_ADMINISTRATOR",
] as const;

export type PositionRoleBlocklistCode =
  (typeof POSITION_ROLE_BLOCKLIST)[number];

/**
 * Allowlist of Role.code values that may be linked to a Position.
 * Keep in sync with seeded operational roles (not platform admin).
 */
export const POSITION_SYSTEM_ROLE_OPTIONS = [
  { value: "LEAVE_APPROVER", label: "Leave Approver" },
  { value: "HR_CLERK", label: "HR Clerk" },
  { value: "HR_LEAVE_OFFICER", label: "HR Leave Officer" },
  { value: "HR_ADMINISTRATOR", label: "HR Administrator" },
  { value: "PAYROLL_CLERK", label: "Payroll Clerk" },
  { value: "PAYROLL_OFFICER", label: "Payroll Officer" },
  {
    value: "HR_PAYROLL_ADMINISTRATOR",
    label: "HR & Payroll Administrator",
  },
] as const;

export type PositionSystemRoleCode =
  (typeof POSITION_SYSTEM_ROLE_OPTIONS)[number]["value"];

const ALLOWED_CODES = new Set<string>(
  POSITION_SYSTEM_ROLE_OPTIONS.map((option) => option.value),
);

const BLOCKED_CODES = new Set<string>(POSITION_ROLE_BLOCKLIST);

/**
 * True when `code` may be stored on Position.systemRoleCode and auto-granted
 * by syncEmployeeAccessRoles. Empty/null clears the link (always allowed).
 */
export function isAllowedPositionSystemRoleCode(
  code: string | null | undefined,
): boolean {
  if (code == null || code.trim() === "") {
    return true;
  }

  const normalized = code.trim();
  if (BLOCKED_CODES.has(normalized)) {
    return false;
  }

  return ALLOWED_CODES.has(normalized);
}

/**
 * Normalize and validate a form/API value for Position.systemRoleCode.
 * Returns `{ ok: true, code }` with null when cleared, or `{ ok: false, message }`.
 */
export function parsePositionSystemRoleCode(
  raw: string | null | undefined,
):
  | { ok: true; code: string | null }
  | { ok: false; message: string } {
  if (raw == null || raw.trim() === "") {
    return { ok: true, code: null };
  }

  const code = raw.trim();

  if (!isAllowedPositionSystemRoleCode(code)) {
    return {
      ok: false,
      message:
        "That role cannot be linked to a position. System Administrator and other elevated identity roles must be assigned in Access administration.",
    };
  }

  return { ok: true, code };
}

/** Whether sync may auto-grant this Role.code from a position. */
export function canSyncPositionRoleCode(code: string): boolean {
  return isAllowedPositionSystemRoleCode(code) && code !== "EMPLOYEE";
}
