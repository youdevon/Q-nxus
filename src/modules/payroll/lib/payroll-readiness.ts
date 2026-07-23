/**
 * Pure payroll readiness evaluation.
 *
 * An employee is payroll-ready when:
 * - a current active employment contract with a base salary above zero exists
 * - the NIS number is recorded (unless exempt from NIS)
 * - the BIR (tax) number is recorded (unless exempt from PAYE)
 * - when paid by bank transfer:
 *   - at least one payment instruction exists
 *   - exactly one instruction is marked primary (receives remainder of net pay)
 *   - every non-primary instruction has a fixed amount greater than zero
 *   - each instruction has ACH-aligned fields: bank/institution, account number,
 *     account holder name (Individual Name), and Savings/Chequing type
 */

import { normalizeAchAccountType } from "@/src/modules/payroll/lib/ach-employee-fields";

export type PayrollBankAccountInput = {
  bankName: string;
  accountNumber: string;
  /** ACH Individual Name — required for bank transfer readiness. */
  accountHolderName?: string | null;
  /** SAVINGS | CHEQUING — required for bank transfer readiness. */
  accountType?: string | null;
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
  /** When true, NIS number is not required for readiness. */
  exemptFromNis?: boolean;
  /** When true, BIR number is not required for readiness. */
  exemptFromPaye?: boolean;
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

  if (!input.exemptFromNis && !input.nisNumber?.trim()) {
    blockingIssues.push("NIS number missing.");
  }

  if (!input.exemptFromPaye && !input.birNumber?.trim()) {
    blockingIssues.push("BIR number missing.");
  }

  if (input.paymentMethod === "BANK_TRANSFER") {
    if (input.bankAccounts.length === 0) {
      blockingIssues.push("No payment instruction on file for bank transfer.");
    } else {
      if (
        input.bankAccounts.some(
          (account) =>
            !account.bankName.trim() || !account.accountNumber.trim(),
        )
      ) {
        blockingIssues.push(
          "A payment instruction is missing its bank / institution or account number.",
        );
      }

      if (
        input.bankAccounts.some(
          (account) => !account.accountHolderName?.trim(),
        )
      ) {
        blockingIssues.push(
          "Each payment instruction needs an account holder name (ACH Individual Name).",
        );
      }

      if (
        input.bankAccounts.some(
          (account) => !normalizeAchAccountType(account.accountType),
        )
      ) {
        blockingIssues.push(
          "Each payment instruction needs account type Savings or Chequing (ACH Payment Type).",
        );
      }

      const primaryCount = input.bankAccounts.filter(
        (account) => account.isPrimary,
      ).length;

      if (primaryCount !== 1) {
        blockingIssues.push(
          "Exactly one payment instruction must be marked as primary (remainder).",
        );
      }

      for (const account of input.bankAccounts) {
        if (account.isPrimary) {
          continue;
        }

        if (account.amount == null || !(account.amount > 0)) {
          blockingIssues.push(
            "Each secondary payment instruction needs a fixed amount greater than zero.",
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
