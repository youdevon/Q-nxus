/**
 * Pure helpers for resolving effective capabilities from role assignments.
 * Used by getUserCapabilities and unit-tested without Prisma.
 */

/** Self-service permissions granted by the EMPLOYEE role template. */
export const SELF_SERVICE_PERMISSION_CODES = [
  "notification.view_own",
  "people.profile.view_own",
  "leave.request",
] as const;

const SELF_SERVICE_SET = new Set<string>(SELF_SERVICE_PERMISSION_CODES);

export const STAFF_ROLE_CODES = [
  "SYSTEM_ADMINISTRATOR",
  "HR_ADMINISTRATOR",
  "HR_PAYROLL_ADMINISTRATOR",
  "HR_CLERK",
  "HR_LEAVE_OFFICER",
  "PAYROLL_CLERK",
  "PAYROLL_OFFICER",
  "LEAVE_APPROVER",
] as const;

const STAFF_ROLE_SET = new Set<string>(STAFF_ROLE_CODES);

export type RolePermissionGrant = {
  roleCode: string;
  permissionCodes: readonly string[];
};

/**
 * Aggregate unique permission codes from all assigned roles.
 * Inactive permission codes should already be filtered by the caller.
 */
export function aggregatePermissionsFromRoles(
  grants: readonly RolePermissionGrant[],
): string[] {
  return [
    ...new Set(grants.flatMap((grant) => [...grant.permissionCodes])),
  ].sort();
}

export function collectRoleCodes(
  grants: readonly RolePermissionGrant[],
): string[] {
  return [...new Set(grants.map((grant) => grant.roleCode))].sort();
}

export function isSystemAdministrator(roleCodes: readonly string[]): boolean {
  return roleCodes.includes("SYSTEM_ADMINISTRATOR");
}

export function isHrAdministrator(roleCodes: readonly string[]): boolean {
  return (
    roleCodes.includes("HR_ADMINISTRATOR") ||
    roleCodes.includes("HR_PAYROLL_ADMINISTRATOR")
  );
}

/**
 * True when the user only has self-service capabilities (no staff roles and
 * no elevated permissions from custom roles).
 */
export function isEmployeeOnlyAccess(
  roleCodes: readonly string[],
  permissions: readonly string[],
): boolean {
  if (isSystemAdministrator(roleCodes)) {
    return false;
  }

  if (roleCodes.some((code) => STAFF_ROLE_SET.has(code))) {
    return false;
  }

  if (permissions.length === 0) {
    return false;
  }

  return permissions.every((permission) => SELF_SERVICE_SET.has(permission));
}
