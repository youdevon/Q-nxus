/**
 * Pure guard for employment-contract hard delete.
 * Delete is for contracts created in error — not a substitute for amend/close.
 *
 * Cleanup mode relaxes leave/payroll guards for expired or past-ended terms
 * so sample and cutover history can be removed without amending first.
 * Later versions are cascaded by the server action when they are also
 * cleanup-eligible.
 */

export type EmploymentContractDeletionInput = {
  /** Later versions with sourceContractId pointing at this row. */
  hasChildAmendments: boolean;
  leaveRequestCount: number;
  /** True when any leave balance has taken or reserved days. */
  hasLeaveUsage: boolean;
  /** True when a POSTED payslip period overlaps this contract’s dates. */
  hasPostedPayrollOverlap: boolean;
  /**
   * Expired / terminated / cancelled / superseded, or end date before today.
   * Leaves and payroll overlap no longer block; leave requests are removed
   * with the contract in the server action. Child versions cascade when
   * cleanup-eligible.
   */
  cleanupEligible: boolean;
};

export type EmploymentContractDeletionResult =
  | { allowed: true; mode: "standard" | "cleanup" }
  | { allowed: false; reason: string };

export function canDeleteEmploymentContract(
  input: EmploymentContractDeletionInput,
): EmploymentContractDeletionResult {
  if (input.cleanupEligible) {
    return { allowed: true, mode: "cleanup" };
  }

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

  return { allowed: true, mode: "standard" };
}
