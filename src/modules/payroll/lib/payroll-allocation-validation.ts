import type { PayrollAllocationType } from "@/generated/prisma/client";

export type AllocationDraft = {
  allocationType: PayrollAllocationType | string;
  fixedAmount: number | null;
  percentage: number | null;
  receivesRemainder: boolean;
  isActive?: boolean;
};

export type AllocationValidationFlags = {
  splitDepositEnabled: boolean;
  fixedAmountEnabled: boolean;
  percentageEnabled: boolean;
  remainderEnabled: boolean;
};

export type AllocationValidationResult = {
  ok: boolean;
  error?: string;
};

/**
 * Phase 1 allocation rules — FULL_BALANCE / FIXED_AMOUNT / REMAINDER only.
 * Does not change payslip net-pay math; validates setup before persist.
 */
export function validatePayrollAllocations(
  allocations: readonly AllocationDraft[],
  flags: AllocationValidationFlags,
): AllocationValidationResult {
  const active = allocations.filter((row) => row.isActive !== false);

  if (active.length === 0) {
    return { ok: true };
  }

  for (const row of active) {
    const type = String(row.allocationType);

    if (type === "PERCENTAGE") {
      if (!flags.percentageEnabled) {
        return {
          ok: false,
          error:
            "Percentage allocations are disabled for this organization (PERCENTAGE_ALLOCATION_ENABLED).",
        };
      }
      if (row.percentage == null || !(row.percentage > 0) || row.percentage > 100) {
        return {
          ok: false,
          error: "Each percentage allocation needs a value between 0 and 100.",
        };
      }
    }

    if (type === "FIXED_AMOUNT") {
      if (!flags.fixedAmountEnabled) {
        return {
          ok: false,
          error:
            "Fixed-amount allocations are disabled for this organization.",
        };
      }
      if (row.fixedAmount == null || !(row.fixedAmount > 0)) {
        return {
          ok: false,
          error: "Each fixed allocation needs an amount greater than zero.",
        };
      }
    }

    if (type === "REMAINDER" && !flags.remainderEnabled) {
      return {
        ok: false,
        error: "Remainder allocations are disabled for this organization.",
      };
    }

    if (type === "FULL_BALANCE" && active.length > 1) {
      return {
        ok: false,
        error: "FULL_BALANCE cannot be combined with other active allocations.",
      };
    }
  }

  if (!flags.splitDepositEnabled) {
    if (active.length !== 1) {
      return {
        ok: false,
        error:
          "Split deposits are disabled — only one FULL_BALANCE allocation is allowed.",
      };
    }
    const only = active[0]!;
    if (String(only.allocationType) !== "FULL_BALANCE") {
      return {
        ok: false,
        error:
          "Split deposits are disabled — the single allocation must be FULL_BALANCE.",
      };
    }
    return { ok: true };
  }

  const remainderCount = active.filter(
    (row) =>
      String(row.allocationType) === "REMAINDER" ||
      String(row.allocationType) === "FULL_BALANCE" ||
      row.receivesRemainder,
  ).length;

  if (remainderCount !== 1) {
    return {
      ok: false,
      error:
        "Mark exactly one account as primary / remainder (or a single FULL_BALANCE).",
    };
  }

  const percentageTotal = active.reduce((sum, row) => {
    if (String(row.allocationType) !== "PERCENTAGE") {
      return sum;
    }
    return sum + Math.max(0, row.percentage ?? 0);
  }, 0);
  if (percentageTotal > 100 + Number.EPSILON) {
    return {
      ok: false,
      error: `Percentage allocations total ${percentageTotal.toFixed(2)}% which exceeds 100%.`,
    };
  }

  return { ok: true };
}

/**
 * Map Phase 1 bank rows (primary + optional fixed/percentage secondaries) to allocation drafts.
 */
export function bankRowsToAllocationDrafts(
  rows: readonly {
    amount: number | null;
    percentage?: number | null;
    isPrimary: boolean;
  }[],
): AllocationDraft[] {
  if (rows.length === 1) {
    return [
      {
        allocationType: "FULL_BALANCE",
        fixedAmount: null,
        percentage: null,
        receivesRemainder: true,
      },
    ];
  }

  return rows.map((row) => {
    if (row.isPrimary) {
      return {
        allocationType: "REMAINDER",
        fixedAmount: null,
        percentage: null,
        receivesRemainder: true,
      };
    }

    if (row.percentage != null && row.percentage > 0) {
      return {
        allocationType: "PERCENTAGE",
        fixedAmount: null,
        percentage: row.percentage,
        receivesRemainder: false,
      };
    }

    return {
      allocationType: "FIXED_AMOUNT",
      fixedAmount: row.amount,
      percentage: null,
      receivesRemainder: false,
    };
  });
}
