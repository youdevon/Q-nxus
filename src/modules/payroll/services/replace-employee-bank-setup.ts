import type { Prisma } from "@/generated/prisma/client";
import { encryptAccountNumber } from "@/src/modules/payroll/lib/bank-account-crypto";
import {
  accountNumberLastFour,
  maskBankAccountForAudit,
} from "@/src/modules/payroll/lib/employee-bank-account-adapter";
import {
  bankRowsToAllocationDrafts,
  validatePayrollAllocations,
} from "@/src/modules/payroll/lib/payroll-allocation-validation";

export type BankAccountWriteInput = {
  financialInstitutionId: string | null;
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  accountName: string | null;
  amount: number | null;
  /** When set (and not primary), store as PERCENTAGE allocation. */
  percentage: number | null;
  isPrimary: boolean;
};

type Tx = Prisma.TransactionClient;

/**
 * Single write path for payroll banking destinations:
 * EmployeeBankAccount + EmployeePayrollAllocation.
 */
export async function replaceEmployeeBankSetup(
  tx: Tx,
  input: {
    organizationId: string;
    employeeId: string;
    /** Kept for call-site compatibility; unused after legacy bank-table drop. */
    payrollProfileId?: string;
    createdByUserId: string | null;
    accounts: readonly BankAccountWriteInput[];
    flags: {
      splitDepositEnabled: boolean;
      fixedAmountEnabled: boolean;
      percentageEnabled: boolean;
      remainderEnabled: boolean;
      multipleAccountsEnabled: boolean;
    };
  },
): Promise<{ error?: string; auditBanks?: Array<Record<string, unknown>> }> {
  void input.payrollProfileId;
  const accounts = [...input.accounts];

  if (accounts.length > 1 && !input.flags.multipleAccountsEnabled) {
    return {
      error:
        "Multiple employee bank accounts are disabled for this organization.",
    };
  }

  const drafts = bankRowsToAllocationDrafts(accounts);
  const validation = validatePayrollAllocations(drafts, {
    splitDepositEnabled: input.flags.splitDepositEnabled,
    fixedAmountEnabled: input.flags.fixedAmountEnabled,
    percentageEnabled: input.flags.percentageEnabled,
    remainderEnabled: input.flags.remainderEnabled,
  });

  if (!validation.ok) {
    return { error: validation.error };
  }

  await tx.employeePayrollAllocation.deleteMany({
    where: { employeeId: input.employeeId },
  });
  await tx.employeeBankAccount.deleteMany({
    where: { employeeId: input.employeeId },
  });

  const primaryIndex = Math.max(
    accounts.findIndex((account) => account.isPrimary),
    0,
  );

  const createdIds: string[] = [];
  const auditBanks: Array<Record<string, unknown>> = [];

  for (const [index, account] of accounts.entries()) {
    const isPrimary = index === primaryIndex;
    const encryptedNumber =
      encryptAccountNumber(account.accountNumber) ?? account.accountNumber;
    const created = await tx.employeeBankAccount.create({
      data: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        financialInstitutionId: account.financialInstitutionId,
        bankName: account.bankName,
        branchName: account.branchName,
        accountHolderName: account.accountName,
        accountNumber: encryptedNumber,
        accountNumberLastFour: accountNumberLastFour(account.accountNumber),
        isPrimary,
        isPayrollEnabled: true,
        sortOrder: index,
        createdByUserId: input.createdByUserId,
      },
      select: { id: true },
    });
    createdIds.push(created.id);

    const usePercentage =
      !isPrimary &&
      accounts.length > 1 &&
      account.percentage != null &&
      account.percentage > 0;

    const allocationType =
      accounts.length === 1
        ? "FULL_BALANCE"
        : isPrimary
          ? "REMAINDER"
          : usePercentage
            ? "PERCENTAGE"
            : "FIXED_AMOUNT";

    await tx.employeePayrollAllocation.create({
      data: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        employeeBankAccountId: created.id,
        allocationType,
        fixedAmount:
          allocationType === "FIXED_AMOUNT" && account.amount != null
            ? account.amount.toFixed(2)
            : null,
        percentage:
          allocationType === "PERCENTAGE" && account.percentage != null
            ? account.percentage.toFixed(4)
            : null,
        receivesRemainder:
          allocationType === "REMAINDER" || allocationType === "FULL_BALANCE",
        priority: index,
        isActive: true,
        createdByUserId: input.createdByUserId,
      },
    });

    auditBanks.push({
      bankName: account.bankName,
      financialInstitutionId: account.financialInstitutionId,
      accountNumber: maskBankAccountForAudit(account.accountNumber),
      accountNumberLastFour: accountNumberLastFour(account.accountNumber),
      amount: isPrimary ? null : account.amount,
      percentage: isPrimary ? null : account.percentage,
      isPrimary,
      allocationType,
    });
  }

  void createdIds;
  return { auditBanks };
}
