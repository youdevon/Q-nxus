/**
 * Post-net bank allocation resolution (feature-flagged).
 *
 * When POST_NET_SPLIT_ENABLED is OFF, callers must keep using
 * applyFixedBankAllocations (FIXED secondaries as deductions).
 *
 * When ON:
 * - netPay = full take-home after statutory (availableAfterStatutory)
 * - Order: FIXED by priority, then PERCENTAGE by priority, then REMAINDER
 * - Percentages ≤ 100%; fixed cannot exceed remaining net; remainder gets rounding residue
 */

import type { PayslipBankLine, PayslipLineItem } from "@/src/modules/payroll/lib/payslip-preview";
import { maskAccountNumber } from "@/src/modules/payroll/lib/payslip-preview";
import {
  fromCents,
  mulCentsRate,
  subCents,
  sumMoney,
  toCents,
} from "@/src/modules/payroll/lib/money";

export type PostNetAllocationAccountInput = {
  bankName: string;
  accountNumber: string;
  /** FIXED amount in currency units, or null. */
  fixedAmount: number | null;
  /** Percentage 0–100 of original net, or null. */
  percentage: number | null;
  kind: "FIXED" | "PERCENTAGE" | "REMAINDER";
  /** Lower runs first within the same kind. */
  priority: number;
};

export type PostNetSplitResult = {
  ok: boolean;
  error?: string;
  /** Always empty for post-net mode — fixed amounts are not payslip deductions. */
  deductions: PayslipLineItem[];
  lines: PayslipBankLine[];
  /** Sum of all bank lines (= net when fully allocated). */
  allocatedTotal: number;
  remainderAmount: number;
  warnings: string[];
};


/**
 * Resolve post-net splits. Does not mutate statutory net definition —
 * `availableAfterStatutory` is the full take-home to distribute.
 */
export function applyPostNetBankAllocations(input: {
  availableAfterStatutory: number;
  accounts: readonly PostNetAllocationAccountInput[];
}): PostNetSplitResult {
  const warnings: string[] = [];
  const netCents = toCents(Math.max(0, input.availableAfterStatutory));
  const net = fromCents(netCents);

  const fixed = [...input.accounts]
    .filter((row) => row.kind === "FIXED")
    .sort((a, b) => a.priority - b.priority);
  const percentages = [...input.accounts]
    .filter((row) => row.kind === "PERCENTAGE")
    .sort((a, b) => a.priority - b.priority);
  const remainders = [...input.accounts]
    .filter((row) => row.kind === "REMAINDER")
    .sort((a, b) => a.priority - b.priority);

  if (remainders.length !== 1) {
    return {
      ok: false,
      error: "Post-net split requires exactly one REMAINDER destination.",
      deductions: [],
      lines: [],
      allocatedTotal: 0,
      remainderAmount: net,
      warnings,
    };
  }

  const percentageTotal = percentages.reduce(
    (sum, row) => sum + Math.max(0, row.percentage ?? 0),
    0,
  );
  if (percentageTotal > 100 + Number.EPSILON) {
    return {
      ok: false,
      error: `Percentage allocations total ${percentageTotal.toFixed(2)}% which exceeds 100%.`,
      deductions: [],
      lines: [],
      allocatedTotal: 0,
      remainderAmount: net,
      warnings,
    };
  }

  const fixedRequested = fixed.reduce(
    (sum, row) => sum + Math.max(0, row.fixedAmount ?? 0),
    0,
  );
  if (fixedRequested > net + Number.EPSILON) {
    return {
      ok: false,
      error: `Fixed allocations (${fixedRequested.toFixed(2)}) exceed net pay (${net.toFixed(2)}).`,
      deductions: [],
      lines: [],
      allocatedTotal: 0,
      remainderAmount: net,
      warnings,
    };
  }

  let remainingCents = netCents;
  const lines: PayslipBankLine[] = [];

  for (const account of fixed) {
    const wantCents = toCents(Math.max(0, account.fixedAmount ?? 0));
    if (wantCents <= 0) {
      continue;
    }
    if (wantCents > remainingCents) {
      return {
        ok: false,
        error: `Fixed allocation to ${account.bankName} exceeds remaining net.`,
        deductions: [],
        lines: [],
        allocatedTotal: 0,
        remainderAmount: fromCents(remainingCents),
        warnings,
      };
    }
    remainingCents = subCents(remainingCents, wantCents);
    lines.push({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountNumberMasked: maskAccountNumber(account.accountNumber),
      amount: fromCents(wantCents),
      kind: "FIXED",
    });
  }

  // Percentages apply to original net (not residual after fixed), per product examples.
  for (const account of percentages) {
    const pct = Math.max(0, account.percentage ?? 0);
    if (pct <= 0) {
      continue;
    }
    const wantCents = mulCentsRate(netCents, pct / 100);
    if (wantCents > remainingCents) {
      return {
        ok: false,
        error: `Percentage allocation to ${account.bankName} exceeds remaining net after fixed amounts.`,
        deductions: [],
        lines: [],
        allocatedTotal: 0,
        remainderAmount: fromCents(remainingCents),
        warnings,
      };
    }
    remainingCents = subCents(remainingCents, wantCents);
    lines.push({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountNumberMasked: maskAccountNumber(account.accountNumber),
      amount: fromCents(wantCents),
      kind: "PERCENTAGE",
    });
  }

  const remainder = remainders[0]!;
  const remainderAmount = fromCents(remainingCents);
  lines.push({
    bankName: remainder.bankName,
    accountNumber: remainder.accountNumber,
    accountNumberMasked: maskAccountNumber(remainder.accountNumber),
    amount: remainderAmount,
    kind: "REMAINDER",
  });

  const allocatedTotal = sumMoney(...lines.map((line) => line.amount));

  if (Math.abs(allocatedTotal - net) > 0.001) {
    warnings.push(
      `Post-net allocation total (${allocatedTotal.toFixed(2)}) differs from net (${net.toFixed(2)}).`,
    );
  }

  return {
    ok: true,
    deductions: [],
    lines,
    allocatedTotal,
    remainderAmount,
    warnings,
  };
}
