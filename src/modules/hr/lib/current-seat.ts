/**
 * Employee.departmentId / positionId are a denormalized **cache** of the current
 * organizational seat — the EmployeeAssignment row with `isCurrent = true`.
 *
 * Do not treat the Employee columns as independent SoT. Assignment writers
 * (hire, assign, structure moves) must update the assignment history and the
 * Employee cache inside the same transaction. Dropping the cache is deferred;
 * this helper documents and guards the invariant.
 */

export type CurrentSeatSnapshot = {
  departmentId: string | null;
  positionId: string | null;
};

export type CurrentAssignmentSeat = {
  departmentId: string;
  positionId: string | null;
};

export function currentSeatMatchesAssignment(
  employee: CurrentSeatSnapshot,
  assignment: CurrentAssignmentSeat | null,
): boolean {
  if (!assignment) {
    return employee.departmentId == null && employee.positionId == null;
  }

  return (
    employee.departmentId === assignment.departmentId &&
    employee.positionId === (assignment.positionId ?? null)
  );
}

export class CurrentSeatMismatchError extends Error {
  constructor(message = "Employee seat cache does not match current assignment.") {
    super(message);
    this.name = "CurrentSeatMismatchError";
  }
}

/** Throws when Employee.departmentId/positionId disagree with the current assignment. */
export function assertCurrentSeatMatchesAssignment(
  employee: CurrentSeatSnapshot,
  assignment: CurrentAssignmentSeat | null,
): void {
  if (!currentSeatMatchesAssignment(employee, assignment)) {
    throw new CurrentSeatMismatchError();
  }
}
