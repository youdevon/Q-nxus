import { isHistoricalEndedContract } from "@/src/modules/hr/lib/historical-contract";

const CLEANUP_STATUSES = new Set([
  "EXPIRED",
  "TERMINATED",
  "CANCELLED",
  "SUPERSEDED",
]);

/**
 * True when a contract may be hard-deleted under cleanup rules
 * (expired status or past end date — including current expired terms).
 */
export function isEmploymentContractCleanupEligible(input: {
  status: string;
  endDate: Date | null;
}): boolean {
  if (CLEANUP_STATUSES.has(input.status)) {
    return true;
  }

  return isHistoricalEndedContract(input.endDate);
}

export type CleanupCascadeContract = {
  id: string;
  sourceContractId: string | null;
  status: string;
  endDate: Date | null;
  isCurrent: boolean;
  contractNumber: string | null;
  jobTitle: string;
};

export type CleanupCascadePlan =
  | {
      ok: true;
      /** Tip-first: delete later versions before earlier ones. */
      contracts: CleanupCascadeContract[];
    }
  | { ok: false; reason: string };

/**
 * Builds a tip-first delete plan for an expired root and every later
 * cleanup-eligible version under it. Live successors (e.g. current ACTIVE)
 * are left in place; their sourceContractId is cleared by FK SetNull.
 */
export function planExpiredContractCleanupCascade(
  rootId: string,
  employeeContracts: CleanupCascadeContract[],
): CleanupCascadePlan {
  const byId = new Map(
    employeeContracts.map((contract) => [contract.id, contract]),
  );
  const root = byId.get(rootId);

  if (!root) {
    return {
      ok: false,
      reason: "The employment contract no longer exists.",
    };
  }

  if (!isEmploymentContractCleanupEligible(root)) {
    return {
      ok: false,
      reason:
        "Only expired, terminated, cancelled, superseded, or past-ended contracts can be cleaned up this way.",
    };
  }

  const childrenBySource = new Map<string, CleanupCascadeContract[]>();
  for (const contract of employeeContracts) {
    if (!contract.sourceContractId) {
      continue;
    }
    const siblings = childrenBySource.get(contract.sourceContractId) ?? [];
    siblings.push(contract);
    childrenBySource.set(contract.sourceContractId, siblings);
  }

  const ordered: CleanupCascadeContract[] = [];

  function walk(id: string) {
    const children = childrenBySource.get(id) ?? [];
    for (const child of children) {
      // Keep live successors; only remove expired / historical chain rows.
      if (!isEmploymentContractCleanupEligible(child)) {
        continue;
      }
      walk(child.id);
    }

    const contract = byId.get(id);
    if (contract) {
      ordered.push(contract);
    }
  }

  walk(rootId);

  return { ok: true, contracts: ordered };
}

/**
 * Tip-first order across a forest of selected cleanup contracts and their
 * cleanup-eligible descendants (used for bulk delete).
 */
export function planBulkExpiredContractCleanup(
  selectedIds: string[],
  employeeContracts: CleanupCascadeContract[],
): CleanupCascadePlan {
  const selected = new Set(selectedIds);
  const byId = new Map(
    employeeContracts.map((contract) => [contract.id, contract]),
  );
  const deleteIds = new Set<string>();
  const blockedReasons: string[] = [];

  for (const id of selected) {
    if (!byId.has(id) || deleteIds.has(id)) {
      continue;
    }

    const plan = planExpiredContractCleanupCascade(id, employeeContracts);
    if (!plan.ok) {
      blockedReasons.push(plan.reason);
      continue;
    }

    for (const contract of plan.contracts) {
      deleteIds.add(contract.id);
    }
  }

  if (deleteIds.size === 0) {
    return {
      ok: false,
      reason:
        blockedReasons[0] ?? "No expired contracts could be deleted.",
    };
  }

  const subset = employeeContracts.filter((contract) =>
    deleteIds.has(contract.id),
  );
  const childrenBySource = new Map<string, CleanupCascadeContract[]>();
  for (const contract of subset) {
    if (!contract.sourceContractId || !deleteIds.has(contract.sourceContractId)) {
      continue;
    }
    const siblings = childrenBySource.get(contract.sourceContractId) ?? [];
    siblings.push(contract);
    childrenBySource.set(contract.sourceContractId, siblings);
  }

  const ordered: CleanupCascadeContract[] = [];
  const visited = new Set<string>();

  function walk(id: string) {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    for (const child of childrenBySource.get(id) ?? []) {
      walk(child.id);
    }
    const contract = byId.get(id);
    if (contract) {
      ordered.push(contract);
    }
  }

  for (const contract of subset) {
    const parentInSet =
      contract.sourceContractId && deleteIds.has(contract.sourceContractId);
    if (!parentInSet) {
      walk(contract.id);
    }
  }

  // Any remaining nodes (cycles / orphans) — append tip-first best-effort.
  for (const contract of subset) {
    walk(contract.id);
  }

  return { ok: true, contracts: ordered };
}
