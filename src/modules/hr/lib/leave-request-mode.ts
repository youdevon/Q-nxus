export type LeaveRequestMode = "self" | "onBehalf";

/** Capability that gates requesting leave for another employee. */
export const LEAVE_ON_BEHALF_PERMISSION = "leave.manage" as const;

export function isLeaveRequestMode(value: string): value is LeaveRequestMode {
  return value === "self" || value === "onBehalf";
}

export function canRequestLeaveOnBehalf(
  can: (permission: string) => boolean,
): boolean {
  return can(LEAVE_ON_BEHALF_PERMISSION);
}

/**
 * Resolves which employee a leave request is for.
 * Self flow always uses the actor's linked employee; on-behalf requires a
 * distinct target and never silently defaults to the actor.
 */
export function resolveLeaveRequestTargetEmployeeId(options: {
  mode: LeaveRequestMode;
  actorEmployeeId: string | null;
  submittedEmployeeId: string | null;
}): { ok: true; employeeId: string } | { ok: false; message: string } {
  if (options.mode === "self") {
    if (!options.actorEmployeeId) {
      return {
        ok: false,
        message: "Your user account is not linked to an employee record.",
      };
    }

    return { ok: true, employeeId: options.actorEmployeeId };
  }

  const submitted = options.submittedEmployeeId?.trim() ?? "";

  if (!submitted) {
    return {
      ok: false,
      message: "Select the employee this leave request is for.",
    };
  }

  if (
    options.actorEmployeeId &&
    submitted === options.actorEmployeeId
  ) {
    return {
      ok: false,
      message:
        "Use My leave to request leave for yourself. This form is for requesting on behalf of another employee.",
    };
  }

  return { ok: true, employeeId: submitted };
}
