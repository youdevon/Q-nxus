/**
 * Leave-balance uniqueness is (contractId, leaveTypeId, cycleStart, cycleEnd).
 * Lookups that need “current cycle” should filter by the contract window.
 */
export function leaveBalanceCycleKey(input: {
  contractId: string;
  leaveTypeId: string;
  cycleStart: Date;
  cycleEnd: Date;
}) {
  return {
    contractId: input.contractId,
    leaveTypeId: input.leaveTypeId,
    cycleStart: input.cycleStart,
    cycleEnd: input.cycleEnd,
  };
}
