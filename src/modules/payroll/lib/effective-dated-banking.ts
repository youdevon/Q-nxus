/**
 * Effective-dated selection for employee bank accounts / allocations.
 */

export function isEffectiveOnDate(
  row: {
    isActive?: boolean;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  },
  asOf: Date,
): boolean {
  if (row.isActive === false) {
    return false;
  }
  const asOfTime = asOf.getTime();
  if (row.effectiveFrom.getTime() > asOfTime) {
    return false;
  }
  if (row.effectiveTo != null && row.effectiveTo.getTime() < asOfTime) {
    return false;
  }
  return true;
}

export function filterEffectiveBankSetup<
  TAccount extends {
    isActive: boolean;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    allocations: Array<{
      isActive: boolean;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    }>;
  },
>(accounts: readonly TAccount[], asOf: Date): TAccount[] {
  return accounts
    .filter((account) => isEffectiveOnDate(account, asOf))
    .map((account) => ({
      ...account,
      allocations: account.allocations.filter((allocation) =>
        isEffectiveOnDate(allocation, asOf),
      ),
    }));
}
