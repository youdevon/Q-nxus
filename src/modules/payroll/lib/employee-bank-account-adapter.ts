import type { PayslipBankAccountInput } from "@/src/modules/payroll/lib/payslip-preview";
import { maskAccountNumber } from "@/src/modules/payroll/lib/payslip-preview";
import type { PayrollBankAccountRecord } from "@/src/modules/payroll/lib/payroll-setup-types";

export type EmployeeBankAccountLike = {
  id: string;
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  accountNumberLastFour?: string | null;
  accountHolderName?: string | null;
  accountName?: string | null;
  accountType?: string | null;
  isPrimary: boolean;
  sortOrder: number;
  financialInstitutionId?: string | null;
  fixedAmount?: number | string | null;
  amount?: number | string | null;
};

export type AllocationLike = {
  employeeBankAccountId: string;
  allocationType: string;
  fixedAmount: number | string | null;
  percentage?: number | string | null;
  receivesRemainder: boolean;
  isActive: boolean;
  priority?: number;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function accountNumberLastFour(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  const trimmed = accountNumber.trim();
  return trimmed.length >= 4 ? trimmed.slice(-4) : trimmed;
}

export function maskBankAccountForAudit(accountNumber: string): string {
  return maskAccountNumber(accountNumber);
}

/**
 * Adapt employee bank accounts + allocations into PayslipBankAccountInput
 * so applyFixedBankAllocations / assemblePayslipPreview stay unchanged.
 *
 * Phase 1 mapping:
 * - FIXED_AMOUNT → secondary with amount (deduction path)
 * - REMAINDER / FULL_BALANCE → primary with amount null
 */
export function toPayslipBankAccountInputs(input: {
  accounts: readonly EmployeeBankAccountLike[];
  allocations?: readonly AllocationLike[] | null;
}): PayslipBankAccountInput[] {
  const accounts = [...input.accounts].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  if (accounts.length === 0) {
    return [];
  }

  const allocations = (input.allocations ?? []).filter((row) => row.isActive);

  if (allocations.length === 0) {
    return accounts.map((account) => ({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      amount: account.isPrimary
        ? null
        : toNumber(account.fixedAmount ?? account.amount),
      isPrimary: account.isPrimary,
      accountType: account.accountType ?? null,
    }));
  }

  const byAccountId = new Map(
    allocations.map((row) => [row.employeeBankAccountId, row]),
  );

  return accounts.map((account) => {
    const allocation = byAccountId.get(account.id);
    if (!allocation) {
      return {
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        amount: account.isPrimary
          ? null
          : toNumber(account.fixedAmount ?? account.amount),
        isPrimary: account.isPrimary,
        accountType: account.accountType ?? null,
      };
    }

    const type = allocation.allocationType;
    const isPrimary =
      type === "REMAINDER" ||
      type === "FULL_BALANCE" ||
      allocation.receivesRemainder;

    return {
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      amount: isPrimary ? null : toNumber(allocation.fixedAmount),
      isPrimary,
      accountType: account.accountType ?? null,
      percentage:
        type === "PERCENTAGE" ? toNumber(allocation.percentage) : null,
      allocationKind:
        type === "PERCENTAGE"
          ? ("PERCENTAGE" as const)
          : isPrimary
            ? ("REMAINDER" as const)
            : ("FIXED" as const),
      priority: allocation.priority,
    };
  });
}

export function toPayrollBankAccountRecords(input: {
  accounts: readonly EmployeeBankAccountLike[];
  allocations?: readonly AllocationLike[] | null;
}): PayrollBankAccountRecord[] {
  const payslipInputs = toPayslipBankAccountInputs(input);
  const byNumber = new Map(
    input.accounts.map((account) => [account.accountNumber, account]),
  );

  return payslipInputs.map((row, index) => {
    const source =
      input.accounts.find(
        (account) =>
          account.accountNumber === row.accountNumber &&
          account.bankName === row.bankName,
      ) ?? byNumber.get(row.accountNumber);

    return {
      id: source?.id ?? `legacy-${index}`,
      bankName: row.bankName,
      branchName: source?.branchName ?? null,
      accountNumber: row.accountNumber,
      accountName:
        source?.accountHolderName ?? source?.accountName ?? null,
      accountType: source?.accountType ?? null,
      amount: row.amount == null ? null : row.amount.toFixed(2),
      isPrimary: row.isPrimary,
      sortOrder: source?.sortOrder ?? index,
      financialInstitutionId: source?.financialInstitutionId ?? null,
      accountNumberLastFour:
        source?.accountNumberLastFour ??
        accountNumberLastFour(row.accountNumber),
    };
  });
}

/**
 * Map EmployeeBankAccount (+ allocations) into readiness bank inputs.
 */
export function resolveBankAccountsForReadiness(input: {
  employeeAccounts: readonly EmployeeBankAccountLike[];
  allocations?: readonly AllocationLike[] | null;
}): Array<{
  bankName: string;
  accountNumber: string;
  accountHolderName: string | null;
  accountType: string | null;
  amount: number | null;
  isPrimary: boolean;
}> {
  if (input.employeeAccounts.length === 0) {
    return [];
  }

  const payslipInputs = toPayslipBankAccountInputs({
    accounts: input.employeeAccounts,
    allocations: input.allocations,
  });

  return payslipInputs.map((row) => {
    const source = input.employeeAccounts.find(
      (account) =>
        account.accountNumber === row.accountNumber &&
        account.bankName === row.bankName,
    );
    return {
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      accountHolderName:
        source?.accountHolderName ?? source?.accountName ?? null,
      accountType: source?.accountType ?? null,
      amount: row.amount,
      isPrimary: row.isPrimary,
    };
  });
}
