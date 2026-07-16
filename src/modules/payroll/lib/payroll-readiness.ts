/**
 * Pure payroll readiness evaluation.
 *
 * An employee is payroll-ready when:
 * - a current active employment contract with a base salary above zero exists
 * - the NIS number is recorded
 * - the BIR (tax) number is recorded
 * - when paid by bank transfer:
 *   - at least one bank account exists
 *   - exactly one account is marked primary (receives remainder of net pay)
 *   - every non-primary account has a fixed amount greater than zero
 */

export type PayrollBankAccountInput = {
  bankName: string;
  accountNumber: string;
  /** Fixed amount for secondary accounts; null/undefined for primary remainder. */
  amount: number | null;
  isPrimary: boolean;
};

export type PayrollReadinessInput = {
  hasCurrentContract: boolean;
  baseSalary: number | null;
  nisNumber: string | null;
  birNumber: string | null;
  paymentMethod: "BANK_TRANSFER" | "CHEQUE" | "CASH";
  bankAccounts: PayrollBankAccountInput[];
};

export type PayrollReadinessResult = {
  isReady: boolean;
  blockingIssues: string[];
};

/** Sum fixed bank amounts in cents (primary remainder accounts are excluded). */
export function bankFixedAmountTotal(
  accounts: Pick<PayrollBankAccountInput, "amount" | "isPrimary">[],
): number {
  const totalCents = accounts.reduce((sum, account) => {
    if (account.isPrimary || account.amount == null) {
      return sum;
    }

    return sum + Math.round(account.amount * 100);
  }, 0);

  return totalCents / 100;
}

export function evaluatePayrollReadiness(
  input: PayrollReadinessInput,
): PayrollReadinessResult {
  const blockingIssues: string[] = [];

  if (!input.hasCurrentContract) {
    blockingIssues.push("No current active employment contract.");
  } else if (input.baseSalary == null || input.baseSalary <= 0) {
    blockingIssues.push("Current contract has no base salary.");
  }

  if (!input.nisNumber?.trim()) {
    blockingIssues.push("NIS number missing.");
  }

  if (!input.birNumber?.trim()) {
    blockingIssues.push("BIR number missing.");
  }

  if (input.paymentMethod === "BANK_TRANSFER") {
    if (input.bankAccounts.length === 0) {
      blockingIssues.push("No bank account on file for bank transfer.");
    } else {
      if (
        input.bankAccounts.some(
          (account) =>
            !account.bankName.trim() || !account.accountNumber.trim(),
        )
      ) {
        blockingIssues.push(
          "A bank account is missing its bank name or account number.",
        );
      }

      const primaryCount = input.bankAccounts.filter(
        (account) => account.isPrimary,
      ).length;

      if (primaryCount !== 1) {
        blockingIssues.push(
          "Exactly one bank account must be marked as primary (remainder).",
        );
      }

      for (const account of input.bankAccounts) {
        if (account.isPrimary) {
          continue;
        }

        if (account.amount == null || !(account.amount > 0)) {
          blockingIssues.push(
            "Each secondary bank account needs a fixed amount greater than zero.",
          );
          break;
        }
      }
    }
  }

  return {
    isReady: blockingIssues.length === 0,
    blockingIssues,
  };
}
