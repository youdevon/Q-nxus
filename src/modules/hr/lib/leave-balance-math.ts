/**
 * Pure leave-balance arithmetic used by reserve / approve / withdraw
 * flows. Values are decimal strings to keep tests and Prisma Decimal
 * serialization aligned.
 */

export type LeaveBalanceSnapshot = {
  reserved: string;
  taken: string;
  availableBalance: string;
};

export type LeaveBalanceComponents = {
  openingBalance: string;
  entitlement: string;
  accrued: string;
  carriedForward: string;
  adjustments: string;
  reserved: string;
  taken: string;
};

function asNumber(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid leave balance quantity: ${value}`);
  }

  return parsed;
}

function formatQuantity(value: number): string {
  // Trim trailing zeros while keeping at least one fractional digit
  // when needed (matches typical Decimal string forms).
  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Number(value.toFixed(4)));
}

/**
 * Available = opening + entitlement + accrued + carried forward + adjustments
 * − reserved − taken.
 */
export function computeLeaveAvailable(
  components: LeaveBalanceComponents,
): string {
  return formatQuantity(
    asNumber(components.openingBalance) +
      asNumber(components.entitlement) +
      asNumber(components.accrued) +
      asNumber(components.carriedForward) +
      asNumber(components.adjustments) -
      asNumber(components.reserved) -
      asNumber(components.taken),
  );
}

export function applyLeaveReserve(
  balance: LeaveBalanceSnapshot,
  quantity: string,
): LeaveBalanceSnapshot {
  const qty = asNumber(quantity);
  const available = asNumber(balance.availableBalance);

  if (qty <= 0) {
    throw new Error("Reserve quantity must be positive.");
  }

  if (available < qty) {
    throw new Error("Insufficient available leave balance.");
  }

  return {
    reserved: formatQuantity(asNumber(balance.reserved) + qty),
    taken: balance.taken,
    availableBalance: formatQuantity(available - qty),
  };
}

/** Approve: move reserved days into taken (available unchanged). */
export function applyLeaveApprove(
  balance: LeaveBalanceSnapshot,
  quantity: string,
): LeaveBalanceSnapshot {
  const qty = asNumber(quantity);
  const reserved = asNumber(balance.reserved);

  if (qty <= 0) {
    throw new Error("Approve quantity must be positive.");
  }

  if (reserved < qty) {
    throw new Error("Insufficient reserved leave to approve.");
  }

  return {
    reserved: formatQuantity(reserved - qty),
    taken: formatQuantity(asNumber(balance.taken) + qty),
    availableBalance: balance.availableBalance,
  };
}

/**
 * Cutover / historical: post leave as taken immediately without a reserve step.
 */
export function applyLeaveTakeDirect(
  balance: LeaveBalanceSnapshot,
  quantity: string,
): LeaveBalanceSnapshot {
  const qty = asNumber(quantity);
  const available = asNumber(balance.availableBalance);

  if (qty <= 0) {
    throw new Error("Take quantity must be positive.");
  }

  if (available < qty) {
    throw new Error("Insufficient available leave balance.");
  }

  return {
    reserved: balance.reserved,
    taken: formatQuantity(asNumber(balance.taken) + qty),
    availableBalance: formatQuantity(available - qty),
  };
}

/** Reject / withdraw pending: release reserved back to available. */
export function applyLeaveRelease(
  balance: LeaveBalanceSnapshot,
  quantity: string,
): LeaveBalanceSnapshot {
  const qty = asNumber(quantity);
  const reserved = asNumber(balance.reserved);

  if (qty <= 0) {
    throw new Error("Release quantity must be positive.");
  }

  if (reserved < qty) {
    throw new Error("Insufficient reserved leave to release.");
  }

  return {
    reserved: formatQuantity(reserved - qty),
    taken: balance.taken,
    availableBalance: formatQuantity(asNumber(balance.availableBalance) + qty),
  };
}

/** Cancel approved leave before start: reverse taken back to available. */
export function applyLeaveCancelTaken(
  balance: LeaveBalanceSnapshot,
  quantity: string,
): LeaveBalanceSnapshot {
  const qty = asNumber(quantity);
  const taken = asNumber(balance.taken);

  if (qty <= 0) {
    throw new Error("Cancel quantity must be positive.");
  }

  if (taken < qty) {
    throw new Error("Insufficient taken leave to cancel.");
  }

  return {
    reserved: balance.reserved,
    taken: formatQuantity(taken - qty),
    availableBalance: formatQuantity(asNumber(balance.availableBalance) + qty),
  };
}

/**
 * Display-layer split: the balance engine posts approved leave into `taken`
 * immediately. Split that stored total into Approved (not yet started) vs
 * Taken (started or completed) without changing ledger math.
 */
export function splitLeaveTakenForDisplay(
  storedTaken: string,
  approvedNotYetStarted: string,
): { taken: string; approved: string } {
  const taken = asNumber(storedTaken);
  const approvedRaw = asNumber(approvedNotYetStarted);

  if (taken < 0) {
    throw new Error("Stored taken leave cannot be negative.");
  }

  if (approvedRaw < 0) {
    throw new Error("Approved not-yet-started quantity cannot be negative.");
  }

  const approved = Math.min(approvedRaw, taken);

  return {
    approved: formatQuantity(approved),
    taken: formatQuantity(taken - approved),
  };
}

/** True when an approved leave period has started (or already ended). */
export function isLeavePeriodStarted(
  startDate: Date,
  asOf: Date = new Date(),
): boolean {
  const asOfUtc = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  );
  const startUtc = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  );

  return startUtc <= asOfUtc;
}
