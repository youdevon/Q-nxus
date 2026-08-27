/**
 * Pure builders for Phase 2 payment snapshots (Calc ≠ Payment).
 * Prefers payslip bankDistribution; never mutates net-pay math.
 */

import type { BankAccountType, PayrollPaymentMethod } from "@/generated/prisma/client";
import {
  decryptAccountNumber,
  encryptAccountNumber,
} from "@/src/modules/payroll/lib/bank-account-crypto";
import {
  maskAccountNumber,
  type PayslipBankLine,
  type PayslipPreview,
} from "@/src/modules/payroll/lib/payslip-preview";
import { accountNumberLastFour } from "@/src/modules/payroll/lib/employee-bank-account-adapter";
import { roundToCents, sumMoney } from "@/src/modules/payroll/lib/money";

export type PaymentBankAccountEnrichment = {
  id: string;
  financialInstitutionId: string | null;
  bankName: string;
  branchCode: string | null;
  branchName: string | null;
  accountHolderName: string | null;
  accountNumber: string;
  accountNumberLastFour: string;
  accountType: BankAccountType;
  sourceAllocationId?: string | null;
  isVerified?: boolean;
};

export type PreparedPaymentAllocationDraft = {
  sourceAllocationId: string | null;
  employeeBankAccountId: string | null;
  financialInstitutionId: string | null;
  beneficiaryName: string | null;
  bankName: string;
  branchCode: string | null;
  branchName: string | null;
  accountType: BankAccountType | null;
  accountNumberMasked: string;
  accountNumberEncrypted: string | null;
  amount: number;
  currencyCode: string;
  sequence: number;
  allocationKind: string;
  status: "PENDING" | "READY";
};

export type PreparedPaymentDraft = {
  payslipId: string;
  employeeId: string;
  netPay: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  paymentMethod: PayrollPaymentMethod;
  paymentStatus:
    | "NOT_CONFIGURED"
    | "PENDING"
    | "PAYMENT_SETUP_REQUIRED"
    | "PAYMENT_SETUP_ERROR"
    | "READY";
  currencyCode: string;
  setupErrorMessage: string | null;
  allocations: PreparedPaymentAllocationDraft[];
};

export type PreparePaymentsSummary = {
  paymentCount: number;
  readyCount: number;
  setupRequiredCount: number;
  notConfiguredCount: number;
  errorCount: number;
  totalAllocated: number;
};


function normalizeAccountKey(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function parsePaymentMethod(value: string | null | undefined): PayrollPaymentMethod {
  if (value === "CHEQUE" || value === "CASH" || value === "BANK_TRANSFER") {
    return value;
  }
  return "BANK_TRANSFER";
}

function plaintextAccountNumber(stored: string | null | undefined): string {
  try {
    return decryptAccountNumber(stored) ?? "";
  } catch {
    return stored ?? "";
  }
}

function findEnrichment(
  line: PayslipBankLine,
  accounts: readonly PaymentBankAccountEnrichment[],
): PaymentBankAccountEnrichment | null {
  const lineDigits = normalizeAccountKey(
    plaintextAccountNumber(line.accountNumber),
  );
  const lineLastFour =
    lineDigits.length >= 4
      ? lineDigits.slice(-4)
      : accountNumberLastFour(line.accountNumberMasked);

  const exact = accounts.find((account) => {
    const digits = normalizeAccountKey(
      plaintextAccountNumber(account.accountNumber),
    );
    return (
      digits.length > 0 &&
      lineDigits.length > 0 &&
      digits === lineDigits &&
      account.bankName.trim().toLowerCase() === line.bankName.trim().toLowerCase()
    );
  });
  if (exact) {
    return exact;
  }

  return (
    accounts.find((account) => {
      const lastFour =
        account.accountNumberLastFour ||
        accountNumberLastFour(plaintextAccountNumber(account.accountNumber));
      return (
        lastFour === lineLastFour &&
        account.bankName.trim().toLowerCase() ===
          line.bankName.trim().toLowerCase()
      );
    }) ?? null
  );
}

function allocationFromBankLine(input: {
  line: PayslipBankLine;
  sequence: number;
  currencyCode: string;
  enrichment: PaymentBankAccountEnrichment | null;
}): PreparedPaymentAllocationDraft {
  const accountNumberPlain =
    plaintextAccountNumber(input.line.accountNumber) ||
    plaintextAccountNumber(input.enrichment?.accountNumber) ||
    null;
  const masked =
    input.line.accountNumberMasked ||
    (accountNumberPlain ? maskAccountNumber(accountNumberPlain) : "••••");

  return {
    sourceAllocationId: input.enrichment?.sourceAllocationId ?? null,
    employeeBankAccountId: input.enrichment?.id ?? null,
    financialInstitutionId: input.enrichment?.financialInstitutionId ?? null,
    beneficiaryName: input.enrichment?.accountHolderName ?? null,
    bankName: input.enrichment?.bankName ?? input.line.bankName,
    branchCode: input.enrichment?.branchCode ?? null,
    branchName: input.enrichment?.branchName ?? null,
    accountType:
      input.enrichment?.accountType ??
      (input.line.accountType === "SAVINGS" ||
      input.line.accountType === "CHEQUING"
        ? input.line.accountType
        : null),
    accountNumberMasked: masked,
    accountNumberEncrypted: accountNumberPlain
      ? encryptAccountNumber(accountNumberPlain)
      : null,
    amount: roundToCents(input.line.amount),
    currencyCode: input.currencyCode,
    sequence: input.sequence,
    allocationKind: input.line.kind,
    status: "READY",
  };
}

/**
 * Build an immutable payment draft from a posted payslip snapshot.
 * Prefer bankDistribution; fall back to live enrichment only when distribution is absent.
 */
export function buildPaymentDraftFromPayslip(input: {
  payslipId: string;
  employeeId: string;
  netPay: number;
  currencyCode: string;
  paymentMethod: string;
  payslip: PayslipPreview | null;
  bankingEnabled: boolean;
  bankAccounts: readonly PaymentBankAccountEnrichment[];
  /** Live-resolved distribution when snapshot has no bankDistribution. */
  fallbackDistribution?: PayslipBankLine[] | null;
  /** When true, bank lines linked to unverified accounts are not READY. */
  requireVerifiedAccounts?: boolean;
}): PreparedPaymentDraft {
  const paymentMethod = parsePaymentMethod(
    input.payslip?.period.paymentMethod ?? input.paymentMethod,
  );
  const netPay = roundToCents(input.netPay);

  if (!input.bankingEnabled) {
    return {
      payslipId: input.payslipId,
      employeeId: input.employeeId,
      netPay,
      allocatedAmount: 0,
      unallocatedAmount: netPay,
      paymentMethod,
      paymentStatus: "NOT_CONFIGURED",
      currencyCode: input.currencyCode,
      setupErrorMessage:
        "Payroll banking is disabled — payment destinations were not prepared.",
      allocations: [],
    };
  }

  if (paymentMethod === "CHEQUE" || paymentMethod === "CASH") {
    return {
      payslipId: input.payslipId,
      employeeId: input.employeeId,
      netPay,
      allocatedAmount: 0,
      unallocatedAmount: netPay,
      paymentMethod,
      paymentStatus: "READY",
      currencyCode: input.currencyCode,
      setupErrorMessage: null,
      allocations: [],
    };
  }

  const distribution =
    input.payslip?.bankDistribution ??
    input.fallbackDistribution ??
    null;

  if (!distribution || distribution.length === 0) {
    return {
      payslipId: input.payslipId,
      employeeId: input.employeeId,
      netPay,
      allocatedAmount: 0,
      unallocatedAmount: netPay,
      paymentMethod,
      paymentStatus: "PAYMENT_SETUP_REQUIRED",
      currencyCode: input.currencyCode,
      setupErrorMessage:
        "No bank distribution on the payslip snapshot and no fallback destinations.",
      allocations: [],
    };
  }

  const positiveLines = distribution.filter((line) => line.amount > 0);
  const allocations = positiveLines.map((line, index) =>
    allocationFromBankLine({
      line,
      sequence: index,
      currencyCode: input.currencyCode,
      enrichment: findEnrichment(line, input.bankAccounts),
    }),
  );

  const allocatedAmount = sumMoney(...allocations.map((row) => row.amount));
  const unallocatedAmount = roundToCents(Math.max(0, netPay - allocatedAmount));

  // Phase 1 formula: REMAINDER line === netPay; FIXED lines are also in deductions.
  // allocatedAmount may exceed netPay when fixed secondaries exist — that is expected.
  const hasMissingAccountNumbers = allocations.some(
    (row) => !row.accountNumberEncrypted && row.accountNumberMasked === "••••",
  );

  if (hasMissingAccountNumbers) {
    return {
      payslipId: input.payslipId,
      employeeId: input.employeeId,
      netPay,
      allocatedAmount,
      unallocatedAmount,
      paymentMethod,
      paymentStatus: "PAYMENT_SETUP_ERROR",
      currencyCode: input.currencyCode,
      setupErrorMessage:
        "One or more bank lines are missing account numbers in the payment snapshot.",
      allocations: allocations.map((row) => ({ ...row, status: "PENDING" as const })),
    };
  }

  const employeeDisplayName =
    input.payslip?.employee?.displayName?.trim() ?? "";
  const hasMissingAchIdentity = allocations.some((row) => {
    const hasIndividualName = Boolean(
      row.beneficiaryName?.trim() || employeeDisplayName,
    );
    const hasAccountType =
      row.accountType === "SAVINGS" || row.accountType === "CHEQUING";
    return !hasIndividualName || !hasAccountType;
  });

  if (hasMissingAchIdentity) {
    return {
      payslipId: input.payslipId,
      employeeId: input.employeeId,
      netPay,
      allocatedAmount,
      unallocatedAmount,
      paymentMethod,
      paymentStatus: "PAYMENT_SETUP_REQUIRED",
      currencyCode: input.currencyCode,
      setupErrorMessage:
        "One or more bank lines are missing Individual Name (account holder) or Savings/Chequing account type required for ACH entry.",
      allocations: allocations.map((row) => ({
        ...row,
        status: "PENDING" as const,
      })),
    };
  }

  if (input.requireVerifiedAccounts) {
    const hasUnverified = allocations.some((row) => {
      if (!row.employeeBankAccountId) {
        return false;
      }
      const account = input.bankAccounts.find(
        (candidate) => candidate.id === row.employeeBankAccountId,
      );
      return account != null && account.isVerified !== true;
    });
    if (hasUnverified) {
      return {
        payslipId: input.payslipId,
        employeeId: input.employeeId,
        netPay,
        allocatedAmount,
        unallocatedAmount,
        paymentMethod,
        paymentStatus: "PAYMENT_SETUP_REQUIRED",
        currencyCode: input.currencyCode,
        setupErrorMessage:
          "One or more bank accounts are unverified. Verify accounts or enable ALLOW_UNVERIFIED_BANK_ACCOUNTS.",
        allocations: allocations.map((row) => ({
          ...row,
          status: "PENDING" as const,
        })),
      };
    }
  }

  return {
    payslipId: input.payslipId,
    employeeId: input.employeeId,
    netPay,
    allocatedAmount,
    unallocatedAmount,
    paymentMethod,
    paymentStatus: "READY",
    currencyCode: input.currencyCode,
    setupErrorMessage: null,
    allocations,
  };
}

export function summarizePreparedPayments(
  drafts: readonly PreparedPaymentDraft[],
): PreparePaymentsSummary {
  return {
    paymentCount: drafts.length,
    readyCount: drafts.filter((row) => row.paymentStatus === "READY").length,
    setupRequiredCount: drafts.filter(
      (row) => row.paymentStatus === "PAYMENT_SETUP_REQUIRED",
    ).length,
    notConfiguredCount: drafts.filter(
      (row) => row.paymentStatus === "NOT_CONFIGURED",
    ).length,
    errorCount: drafts.filter(
      (row) => row.paymentStatus === "PAYMENT_SETUP_ERROR",
    ).length,
    totalAllocated: sumMoney(...drafts.map((row) => row.allocatedAmount)),
  };
}
