/**
 * Pure guard for employment-contract hard delete.
 * Delete is for contracts created in error — not a substitute for amend/close.
 */

export type EmploymentContractDeletionInput = {
  /** Later versions with sourceContractId pointing at this row. */
  hasChildAmendments: boolean;
  leaveRequestCount: number;
  /** True when any leave balance has taken or reserved days. */
  hasLeaveUsage: boolean;
  /** True when a POSTED payslip period overlaps this contract’s dates. */
  hasPostedPayrollOverlap: boolean;
};

export type EmploymentContractDeletionResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function canDeleteEmploymentContract(
  input: EmploymentContractDeletionInput,
): EmploymentContractDeletionResult {
  if (input.hasChildAmendments) {
    return {
      allowed: false,
      reason:
        "This contract was superseded by a later version. Delete the latest unused contract first.",
    };
  }

  if (input.leaveRequestCount > 0) {
    return {
      allowed: false,
      reason:
        "This contract has leave requests and cannot be deleted. Prefer amend or close instead.",
    };
  }

  if (input.hasLeaveUsage) {
    return {
      allowed: false,
      reason:
        "This contract has leave usage recorded and cannot be deleted. Prefer amend or close instead.",
    };
  }

  if (input.hasPostedPayrollOverlap) {
    return {
      allowed: false,
      reason:
        "This contract overlaps a posted pay period for the employee and cannot be deleted. Prefer amend instead.",
    };
  }

  return { allowed: true };
}
