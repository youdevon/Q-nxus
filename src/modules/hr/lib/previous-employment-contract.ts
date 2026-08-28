const AMENDMENT_CHANGE_TYPES = new Set([
  "AMENDMENT",
  "SALARY_ADJUSTMENT",
  "POSITION_CHANGE",
]);

const TERM_BOUNDARY_CHANGE_TYPES = new Set([
  "RENEWAL",
  "EXTENSION",
  "TERMINATION",
]);

export type PreviousEmploymentContractCandidate = {
  id: string;
  isCurrent: boolean;
  status: string;
};

export type PreviousEmploymentContractPeer = {
  id: string;
  sourceContractId: string | null;
  changeType: string;
};

/**
 * Previous contracts = employment periods the employee worked through
 * (expired, terminated, or superseded by renewal/extension).
 *
 * Mid-term amendments (and salary/position adjustments) supersede a row for
 * versioning only — those predecessors belong in contract version history,
 * not the employee’s previous-contracts list.
 */
export function isPreviousEmploymentContract(
  contract: PreviousEmploymentContractCandidate,
  peers: PreviousEmploymentContractPeer[],
): boolean {
  if (contract.isCurrent) {
    return false;
  }

  if (contract.status === "EXPIRED" || contract.status === "TERMINATED") {
    return true;
  }

  if (contract.status !== "SUPERSEDED") {
    return false;
  }

  const successors = peers.filter(
    (peer) => peer.sourceContractId === contract.id,
  );

  if (
    successors.some((peer) => TERM_BOUNDARY_CHANGE_TYPES.has(peer.changeType))
  ) {
    return true;
  }

  if (successors.some((peer) => AMENDMENT_CHANGE_TYPES.has(peer.changeType))) {
    return false;
  }

  // Superseded without a typed successor — keep visible as employment history.
  return true;
}
