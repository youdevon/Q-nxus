/**
 * Payment-instruction domain layer.
 * Backed by EmployeeBankAccount + EmployeePayrollAllocation (HR Employee remains SoT).
 */

import { roundToCents, sumMoney } from "@/src/modules/payroll/lib/money";

export type PaymentAllocationMethod = "FIXED" | "PERCENTAGE" | "REMAINING";

export type PaymentInstructionLike = {
  id: string;
  employeeId: string;
  employeeNumber?: string | null;
  accountHolderName: string | null;
  financialInstitutionId: string | null;
  bankName: string;
  routingNumber: string | null;
  branchCode: string | null;
  branchName: string | null;
  accountNumberLastFour: string;
  accountType: string;
  allocationMethod: PaymentAllocationMethod;
  allocationValue: number | null;
  priority: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  verificationStatus: string;
  isVerified: boolean;
  dataSource: string;
  changeReason: string | null;
};

export type AllocationTestResult = {
  ok: boolean;
  blockingErrors: string[];
  warnings: string[];
  allocatedFixed: number;
  allocatedPercentage: number;
  remainderAmount: number | null;
  totalAllocated: number | null;
};

function isEffectiveOn(row: PaymentInstructionLike, asOf: Date): boolean {
  if (!row.isActive) {
    return false;
  }
  if (row.effectiveFrom.getTime() > asOf.getTime()) {
    return false;
  }
  if (row.effectiveTo != null && row.effectiveTo.getTime() < asOf.getTime()) {
    return false;
  }
  return true;
}

export function selectActivePaymentInstructions(
  instructions: readonly PaymentInstructionLike[],
  asOf: Date = new Date(),
): PaymentInstructionLike[] {
  return instructions
    .filter((row) => isEffectiveOn(row, asOf))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

/**
 * Validate that active instructions can fully cover net pay without over-allocation.
 * Remaining-balance absorbs two-decimal rounding differences.
 */
export function validatePaymentInstructionAllocation(
  instructions: readonly PaymentInstructionLike[],
  netPay: number | null,
  asOf: Date = new Date(),
): AllocationTestResult {
  const active = selectActivePaymentInstructions(instructions, asOf);
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  if (active.length === 0) {
    blockingErrors.push("No active payment instructions.");
    return {
      ok: false,
      blockingErrors,
      warnings,
      allocatedFixed: 0,
      allocatedPercentage: 0,
      remainderAmount: null,
      totalAllocated: null,
    };
  }

  const remaining = active.filter((row) => row.allocationMethod === "REMAINING");
  if (remaining.length !== 1) {
    blockingErrors.push(
      remaining.length === 0
        ? "Exactly one remaining-balance instruction is required."
        : "Only one remaining-balance instruction may be active.",
    );
  }

  const destinationKeys = new Set<string>();
  for (const row of active) {
    const key = `${(row.routingNumber ?? "").trim()}|${row.accountNumberLastFour}|${row.accountType}`;
    if (destinationKeys.has(key) && row.accountNumberLastFour) {
      blockingErrors.push(
        `Duplicate destination account ending in ${row.accountNumberLastFour}.`,
      );
    }
    destinationKeys.add(key);

    if (row.verificationStatus === "FAILED") {
      blockingErrors.push(
        `Instruction ending in ${row.accountNumberLastFour || "????"} failed verification.`,
      );
    } else if (
      row.verificationStatus === "PENDING" ||
      (row.verificationStatus !== "VERIFIED" &&
        row.verificationStatus !== "NOT_REQUIRED" &&
        !row.isVerified)
    ) {
      warnings.push(
        `Instruction ending in ${row.accountNumberLastFour || "????"} is unverified.`,
      );
    }
  }

  let allocatedFixed = 0;
  let allocatedPercentage = 0;
  for (const row of active) {
    if (row.allocationMethod === "FIXED") {
      const value = row.allocationValue ?? 0;
      if (!(value > 0)) {
        blockingErrors.push(
          `Fixed instruction ending in ${row.accountNumberLastFour || "????"} needs a positive amount.`,
        );
      }
      allocatedFixed = roundToCents(allocatedFixed + value);
    }
    if (row.allocationMethod === "PERCENTAGE") {
      const value = row.allocationValue ?? 0;
      if (!(value > 0) || value > 100) {
        blockingErrors.push(
          `Percentage instruction ending in ${row.accountNumberLastFour || "????"} must be between 0 and 100.`,
        );
      }
      allocatedPercentage += value;
    }
  }

  if (allocatedPercentage > 100 + Number.EPSILON) {
    blockingErrors.push(
      `Percentage allocations total ${allocatedPercentage.toFixed(2)}% which exceeds 100%.`,
    );
  }

  let remainderAmount: number | null = null;
  let totalAllocated: number | null = null;

  if (netPay != null) {
    const net = roundToCents(netPay);
    if (allocatedFixed > net + Number.EPSILON) {
      blockingErrors.push(
        `Fixed allocations (${allocatedFixed.toFixed(2)}) exceed net pay (${net.toFixed(2)}).`,
      );
    }
    const afterFixed = roundToCents(Math.max(0, net - allocatedFixed));
    const percentAmount = roundToCents((afterFixed * allocatedPercentage) / 100);
    if (percentAmount > afterFixed + Number.EPSILON) {
      blockingErrors.push(
        `Percentage allocations exceed remaining net after fixed amounts.`,
      );
    }
    remainderAmount = roundToCents(afterFixed - percentAmount);
    totalAllocated = sumMoney(allocatedFixed, percentAmount, remainderAmount);
    if (Math.abs(totalAllocated - net) > 0.009) {
      blockingErrors.push(
        `Allocations total ${totalAllocated.toFixed(2)} but net pay is ${net.toFixed(2)}.`,
      );
    }
  }

  return {
    ok: blockingErrors.length === 0,
    blockingErrors,
    warnings,
    allocatedFixed,
    allocatedPercentage,
    remainderAmount,
    totalAllocated,
  };
}

export function mapAllocationTypeToMethod(
  allocationType: string,
  receivesRemainder: boolean,
): PaymentAllocationMethod {
  if (
    allocationType === "REMAINDER" ||
    allocationType === "FULL_BALANCE" ||
    receivesRemainder
  ) {
    return "REMAINING";
  }
  if (allocationType === "PERCENTAGE") {
    return "PERCENTAGE";
  }
  return "FIXED";
}

export function mapMethodToAllocationType(
  method: PaymentAllocationMethod,
): "FIXED_AMOUNT" | "PERCENTAGE" | "REMAINDER" {
  if (method === "PERCENTAGE") {
    return "PERCENTAGE";
  }
  if (method === "REMAINING") {
    return "REMAINDER";
  }
  return "FIXED_AMOUNT";
}

/**
 * First Citizens Business Online Payment Type label from account type.
 * Bank UI uses US spelling "Checking Credit" (not Chequing).
 */
export function firstCitizensPaymentType(accountType: string): string {
  const normalized = accountType.toUpperCase();
  if (
    normalized === "CHEQUING" ||
    normalized === "CHECKING" ||
    normalized === "CURRENT"
  ) {
    return "Checking Credit";
  }
  if (normalized === "SAVINGS") {
    return "Savings Credit";
  }
  return "Savings Credit";
}

/** Normalize legacy / free-text Payment Type labels to the bank UI values. */
export function normalizeFirstCitizensPaymentTypeLabel(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const upper = trimmed.toUpperCase();
  if (upper === "CHEQUING CREDIT" || upper === "CHECKING CREDIT") {
    return "Checking Credit";
  }
  if (upper === "SAVINGS CREDIT") {
    return "Savings Credit";
  }
  if (upper === "CHEQUING" || upper === "CHECKING" || upper === "CURRENT") {
    return "Checking Credit";
  }
  if (upper === "SAVINGS") {
    return "Savings Credit";
  }
  return trimmed;
}

/**
 * Resolve ACH Payment Type without inventing a Savings default.
 * Returns null when neither a frozen label nor account type is available.
 */
export function resolveFirstCitizensPaymentType(input: {
  paymentType?: string | null;
  accountType?: string | null;
}): string | null {
  const fromLabel = normalizeFirstCitizensPaymentTypeLabel(input.paymentType);
  if (fromLabel) {
    return fromLabel;
  }
  if (input.accountType?.trim()) {
    return firstCitizensPaymentType(input.accountType);
  }
  return null;
}

/**
 * Effective ABA label for FCB entry: routing → ACH code → institution name.
 * Does not invent official routing codes.
 */
export function resolveFirstCitizensAbaNumber(input: {
  routingNumber?: string | null;
  routingCode?: string | null;
  institutionDisplayName?: string | null;
  bankName?: string | null;
}): string {
  return (
    input.routingNumber?.trim() ||
    input.routingCode?.trim() ||
    input.institutionDisplayName?.trim() ||
    input.bankName?.trim() ||
    ""
  );
}
