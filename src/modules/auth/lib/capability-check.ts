/**
 * Pure capability evaluation (mirrors getUserCapabilities.can / canAny
 * without the SYSTEM_ADMINISTRATOR bypass when testing role grants).
 */

export const PAYROLL_VIEW_CAPABILITIES = [
  "payroll.view",
  "payroll.setup",
  "payroll.manage",
] as const;

export const PAYROLL_SETUP_CAPABILITIES = [
  "payroll.setup",
  "payroll.manage",
  "payroll.bank_accounts.create",
  "payroll.bank_accounts.update",
  "payroll.allocations.manage",
] as const;

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

/** Read payroll directories / payslips (not own /me payslip). */
export function canViewPayroll(
  granted: readonly string[],
  options?: { isSystemAdmin?: boolean },
): boolean {
  return hasAnyCapability(granted, PAYROLL_VIEW_CAPABILITIES, options);
}

/** Edit employee payroll profiles / readiness setup. */
export function canSetupPayroll(
  granted: readonly string[],
  options?: { isSystemAdmin?: boolean },
): boolean {
  return hasAnyCapability(granted, PAYROLL_SETUP_CAPABILITIES, options);
}

/** Create / recalculate / post / delete pay runs and statutory settings. */
export function canManagePayrollRuns(
  granted: readonly string[],
  options?: { isSystemAdmin?: boolean },
): boolean {
  return hasCapability(granted, "payroll.manage", options);
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
