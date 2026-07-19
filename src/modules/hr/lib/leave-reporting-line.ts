/**
 * Pure helpers for walking the position reporting line and deciding
 * who must acknowledge a leave request before the final approver.
 */

export type ReportingLinePosition = {
  id: string;
  title: string;
  reportsToPositionId: string | null;
};

export type ReportingLineHolder = {
  positionId: string;
  employeeId: string;
  employeeName: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
};

export type ReportingLineNode = {
  sequenceNumber: number;
  positionId: string;
  positionTitle: string;
  employeeId: string | null;
  employeeName: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
};

/**
 * Walk from `startPositionId` up the reporting line until (and including)
 * `stopPositionId` if provided, or until the top of the tree.
 * Does not include `startPositionId` itself — only ancestors.
 */
export function walkReportingLineAncestors(input: {
  startPositionId: string;
  positionsById: Map<string, ReportingLinePosition>;
  /** Stop when this position is reached (included in the walk). */
  stopPositionId?: string | null;
  maxHops?: number;
}): ReportingLinePosition[] {
  const maxHops = input.maxHops ?? 50;
  const ancestors: ReportingLinePosition[] = [];
  const visited = new Set<string>([input.startPositionId]);
  let currentId =
    input.positionsById.get(input.startPositionId)?.reportsToPositionId ?? null;
  let hops = 0;

  while (currentId && hops < maxHops) {
    if (visited.has(currentId)) {
      break;
    }

    visited.add(currentId);
    const position = input.positionsById.get(currentId);

    if (!position) {
      break;
    }

    ancestors.push(position);

    if (
      input.stopPositionId &&
      position.id === input.stopPositionId
    ) {
      break;
    }

    currentId = position.reportsToPositionId;
    hops += 1;
  }

  return ancestors;
}

/**
 * Positions/people between the requester's position and the final approver
 * (excluding the requester and excluding the final approver, who approves).
 *
 * Sequence 1 = closest to the requester (first hop up).
 */
export function resolveAcknowledgementChain(input: {
  requesterPositionId: string;
  finalApproverPositionId: string;
  positionsById: Map<string, ReportingLinePosition>;
  holdersByPositionId: Map<string, ReportingLineHolder>;
  /** Exclude the leave requester if they somehow appear as a holder. */
  excludeEmployeeId?: string | null;
}): {
  chain: ReportingLineNode[];
  reachedFinalApprover: boolean;
  issue:
    | null
    | "FINAL_NOT_IN_LINE"
    | "EMPTY_CHAIN_OK"
    | "MISSING_HOLDER_USER";
} {
  if (input.requesterPositionId === input.finalApproverPositionId) {
    return {
      chain: [],
      reachedFinalApprover: true,
      issue: "EMPTY_CHAIN_OK",
    };
  }

  const ancestors = walkReportingLineAncestors({
    startPositionId: input.requesterPositionId,
    positionsById: input.positionsById,
    stopPositionId: input.finalApproverPositionId,
  });

  const reachedFinalApprover = ancestors.some(
    (position) => position.id === input.finalApproverPositionId,
  );

  if (!reachedFinalApprover) {
    return {
      chain: [],
      reachedFinalApprover: false,
      issue: "FINAL_NOT_IN_LINE",
    };
  }

  const between = ancestors.filter(
    (position) => position.id !== input.finalApproverPositionId,
  );

  const chain: ReportingLineNode[] = [];
  let missingUser = false;

  for (let index = 0; index < between.length; index += 1) {
    const position = between[index]!;
    const holder = input.holdersByPositionId.get(position.id) ?? null;

    if (
      holder &&
      input.excludeEmployeeId &&
      holder.employeeId === input.excludeEmployeeId
    ) {
      continue;
    }

    if (holder && !holder.userId) {
      missingUser = true;
    }

    chain.push({
      sequenceNumber: chain.length + 1,
      positionId: position.id,
      positionTitle: position.title,
      employeeId: holder?.employeeId ?? null,
      employeeName: holder?.employeeName ?? null,
      userId: holder?.userId ?? null,
      userEmail: holder?.userEmail ?? null,
      userName: holder?.userName ?? null,
    });
  }

  return {
    chain,
    reachedFinalApprover: true,
    issue: missingUser
      ? "MISSING_HOLDER_USER"
      : chain.length === 0
        ? "EMPTY_CHAIN_OK"
        : null,
  };
}

export type AcknowledgementProgressItem = {
  sequenceNumber: number;
  status: string;
  acknowledgerUserId: string | null;
};

/**
 * Whether the next acknowledgement is allowed for `actorUserId`.
 */
export function canAcknowledgeLeaveRequest(input: {
  acknowledgements: AcknowledgementProgressItem[];
  actorUserId: string;
  ackOrder: "ANY" | "SEQUENTIAL";
  canManageLeave: boolean;
}): { ok: true; targetSequence: number } | { ok: false; reason: string } {
  const pending = input.acknowledgements
    .filter((item) => item.status === "PENDING")
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  if (pending.length === 0) {
    return { ok: false, reason: "All acknowledgements are already complete." };
  }

  if (input.canManageLeave) {
    return { ok: true, targetSequence: pending[0]!.sequenceNumber };
  }

  if (input.ackOrder === "SEQUENTIAL") {
    const next = pending[0]!;

    if (next.acknowledgerUserId !== input.actorUserId) {
      return {
        ok: false,
        reason: "It is not your turn to acknowledge this leave request.",
      };
    }

    return { ok: true, targetSequence: next.sequenceNumber };
  }

  const mine = pending.find(
    (item) => item.acknowledgerUserId === input.actorUserId,
  );

  if (!mine) {
    return {
      ok: false,
      reason: "You are not assigned to acknowledge this leave request.",
    };
  }

  return { ok: true, targetSequence: mine.sequenceNumber };
}

/**
 * Whether the final approver may act given acknowledgement progress.
 */
export function canFinalApproverAct(input: {
  requireAllAcksBeforeFinal: boolean;
  acknowledgements: Array<{ status: string }>;
}): boolean {
  if (!input.requireAllAcksBeforeFinal) {
    return true;
  }

  if (input.acknowledgements.length === 0) {
    return true;
  }

  return input.acknowledgements.every(
    (item) =>
      item.status === "ACKNOWLEDGED" ||
      item.status === "SKIPPED" ||
      item.status === "CANCELLED",
  );
}

export function allAcknowledgementsComplete(
  acknowledgements: Array<{ status: string }>,
): boolean {
  if (acknowledgements.length === 0) {
    return true;
  }

  return acknowledgements.every(
    (item) =>
      item.status === "ACKNOWLEDGED" || item.status === "SKIPPED",
  );
}
