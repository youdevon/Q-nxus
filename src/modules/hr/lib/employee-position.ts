/**
 * Org Position (`Employee.positionId` / current assignment) is the source of
 * truth for an employee's position. `EmploymentContract.jobTitle` and payslip
 * `jobTitle` are historical snapshots written from that value — use them only
 * as a fallback when no live Position is set. Prefer the label "Position" in UI.
 */
export function resolveEmployeePositionTitle(input: {
  assignmentPositionTitle?: string | null;
  positionTitle?: string | null;
  /** Historical snapshot only — last resort when no live Position is set */
  contractJobTitle?: string | null;
}): string | null {
  const fromAssignment = input.assignmentPositionTitle?.trim() || null;
  if (fromAssignment) {
    return fromAssignment;
  }

  const fromPosition = input.positionTitle?.trim() || null;
  if (fromPosition) {
    return fromPosition;
  }

  return input.contractJobTitle?.trim() || null;
}
