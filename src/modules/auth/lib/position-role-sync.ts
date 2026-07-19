import { canSyncPositionRoleCode } from "@/src/modules/auth/lib/position-system-roles";

export type PositionRoleSyncPlan = {
  /** Role codes that should have an ACTIVE POSITION-sourced grant. */
  desiredCodes: string[];
};

/**
 * Pure planner for which Role.codes position sync should keep.
 * SYSTEM_ADMINISTRATOR and other non-allowlisted codes never appear.
 */
export function planPositionRoleSync(input: {
  systemRoleCode: string | null | undefined;
  hasDirectReports: boolean;
}): PositionRoleSyncPlan {
  const raw = input.systemRoleCode?.trim() || null;
  const desired = new Set<string>();

  const isLeaveApprover =
    input.hasDirectReports || raw === "LEAVE_APPROVER";

  if (isLeaveApprover) {
    desired.add("LEAVE_APPROVER");
  }

  if (raw && raw !== "LEAVE_APPROVER" && canSyncPositionRoleCode(raw)) {
    desired.add(raw);
  }

  return { desiredCodes: [...desired] };
}

/**
 * Which POSITION-sourced role IDs should be revoked given the keep set.
 */
export function positionRoleIdsToRevoke(input: {
  activePositionRoleIds: string[];
  keepRoleIds: string[];
}): string[] {
  const keep = new Set(input.keepRoleIds);
  return input.activePositionRoleIds.filter((id) => !keep.has(id));
}
