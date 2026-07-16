/**
 * Pure capability evaluation (mirrors getUserCapabilities.can / canAny
 * without the SYSTEM_ADMINISTRATOR bypass when testing role grants).
 */

export function hasCapability(
  granted: readonly string[],
  required: string,
  options?: { isSystemAdmin?: boolean },
): boolean {
  if (options?.isSystemAdmin) {
    return true;
  }

  return granted.includes(required);
}

export function hasAnyCapability(
  granted: readonly string[],
  required: readonly string[],
  options?: { isSystemAdmin?: boolean },
): boolean {
  if (options?.isSystemAdmin) {
    return true;
  }

  if (required.length === 0) {
    return true;
  }

  return required.some((permission) => granted.includes(permission));
}

/** Admin mutations must not succeed on view-only grants. */
export function canPerformAdminMutation(
  granted: readonly string[],
  writePermissions: readonly string[],
  options?: { isSystemAdmin?: boolean },
): boolean {
  if (options?.isSystemAdmin) {
    return true;
  }

  if (granted.includes("administration.manage")) {
    return true;
  }

  return writePermissions.some((permission) => granted.includes(permission));
}
