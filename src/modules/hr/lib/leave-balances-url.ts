/**
 * Canonical People leave-balances lookup URLs.
 * Used by search, forfeiture alerts, and the use-or-lose queue.
 */

export type LeaveBalancesFocus = "forfeiture";

export function buildLeaveBalancesUrl(input: {
  employeeId?: string | null;
  query?: string | null;
  focus?: LeaveBalancesFocus | null;
}): string {
  const params = new URLSearchParams();

  if (input.employeeId?.trim()) {
    params.set("employeeId", input.employeeId.trim());
  }

  if (input.query?.trim()) {
    params.set("query", input.query.trim());
  }

  if (input.focus) {
    params.set("focus", input.focus);
  }

  const qs = params.toString();
  return qs ? `/people/leave/balances?${qs}` : "/people/leave/balances";
}

/** Self-service destination when the employee cannot open People balances. */
export function buildSelfLeaveForfeitureUrl(): string {
  return "/me/leave?focus=forfeiture";
}
