/**
 * Pure guard for department hard delete.
 *
 * Delete unassigns current employees, removes the department's positions, and
 * clears assignment rows that reference the department so the FK can release.
 * Contracts are preserved. There are no hard blockers today beyond authz /
 * confirmation handled by the delete action.
 */

export type DepartmentDeletionInput = {
  /** @deprecated Unassigned during delete — no longer a blocker. */
  positionCount?: number;
  /** @deprecated Unassigned during delete — no longer a blocker. */
  employeeCount?: number;
  /** @deprecated Cleared during delete — no longer a blocker. */
  assignmentCount?: number;
};

export type DepartmentDeletionResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function canDeleteDepartment(
  _input: DepartmentDeletionInput = {},
): DepartmentDeletionResult {
  return { allowed: true };
}
