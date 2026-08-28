import type { BankingDataSource, Prisma } from "@/generated/prisma/client";
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
  branchCode?: string | null;
  routingNumber?: string | null;
  accountNumber: string;
  accountName: string | null;
  accountType?: "SAVINGS" | "CHEQUING" | "CURRENT" | "CREDIT_UNION_SHARES" | "OTHER";
  amount: number | null;
  /** When set (and not primary), store as PERCENTAGE allocation. */
  percentage: number | null;
  isPrimary: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  changeReason?: string | null;
  dataSource?: BankingDataSource;
  verificationStatus?: "NOT_REQUIRED" | "PENDING" | "VERIFIED" | "FAILED";
  isVerified?: boolean;
};

type Tx = Prisma.TransactionClient;

/**
 * Soft-deactivate active bank accounts + allocations (preserve history).
 * Never hard-deletes rows referenced by frozen payment snapshots.
 */
export async function deactivateEmployeeBankSetup(
  tx: Tx,
  input: {
    employeeId: string;
    changeReason?: string | null;
    asOf?: Date;
  },
): Promise<string[]> {
  const asOf = input.asOf ?? new Date();
  const active = await tx.employeeBankAccount.findMany({
    where: { employeeId: input.employeeId, isActive: true },
    select: { id: true },
  });
  const ids = active.map((row) => row.id);
  if (ids.length === 0) {
    return [];
  }

  await tx.employeePayrollAllocation.updateMany({
    where: { employeeBankAccountId: { in: ids }, isActive: true },
    data: {
      isActive: false,
      effectiveTo: asOf,
    },
  });

  await tx.employeeBankAccount.updateMany({
    where: { id: { in: ids } },
    data: {
      isActive: false,
      isPrimary: false,
      isPayrollEnabled: false,
      effectiveTo: asOf,
      archivedAt: asOf,
      changeReason: input.changeReason ?? "Replaced by updated payment instructions",
    },
  });

  return ids;
}

/**
 * Single write path for payroll banking destinations:
 * EmployeeBankAccount + EmployeePayrollAllocation.
 * Soft-deactivates prior active rows so history (and approved batches) stay intact.
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
    changeReason?: string | null;
    dataSource?: BankingDataSource;
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

  const supersededIds = await deactivateEmployeeBankSetup(tx, {
    employeeId: input.employeeId,
    changeReason: input.changeReason ?? "Replaced by updated payment instructions",
  });
  const primarySupersededId = supersededIds[0] ?? null;

  const primaryIndex = Math.max(
    accounts.findIndex((account) => account.isPrimary),
    0,
  );

  const auditBanks: Array<Record<string, unknown>> = [];
  const dataSource = input.dataSource ?? "MANUAL";

  for (const [index, account] of accounts.entries()) {
    const isPrimary = index === primaryIndex;
    const encryptedNumber =
      encryptAccountNumber(account.accountNumber) ?? account.accountNumber;
    const verificationStatus =
      account.verificationStatus ??
      (account.isVerified ? "VERIFIED" : "NOT_REQUIRED");
    const created = await tx.employeeBankAccount.create({
      data: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        financialInstitutionId: account.financialInstitutionId,
        bankName: account.bankName,
        routingNumber: account.routingNumber ?? null,
        branchCode: account.branchCode ?? null,
        branchName: account.branchName,
        accountHolderName: account.accountName,
        accountNumber: encryptedNumber,
        accountNumberLastFour: accountNumberLastFour(account.accountNumber),
        accountType: account.accountType ?? "SAVINGS",
        isPrimary,
        isPayrollEnabled: true,
        isVerified: account.isVerified ?? verificationStatus === "VERIFIED",
        verificationStatus,
        effectiveFrom: account.effectiveFrom ?? new Date(),
        effectiveTo: account.effectiveTo ?? null,
        sortOrder: index,
        dataSource: account.dataSource ?? dataSource,
        changeReason: account.changeReason ?? input.changeReason ?? null,
        supersedesAccountId: index === 0 ? primarySupersededId : null,
        createdByUserId: input.createdByUserId,
      },
      select: { id: true },
    });

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
        effectiveFrom: account.effectiveFrom ?? new Date(),
        effectiveTo: account.effectiveTo ?? null,
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
      dataSource: account.dataSource ?? dataSource,
    });
  }

  return { auditBanks };
}
