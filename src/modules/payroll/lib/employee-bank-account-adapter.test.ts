import { describe, expect, it } from "vitest";

import {
  resolveBankAccountsForReadiness,
  toPayslipBankAccountInputs,
  toPayrollBankAccountRecords,
} from "./employee-bank-account-adapter";
import {
  bankRowsToAllocationDrafts,
  validatePayrollAllocations,
} from "./payroll-allocation-validation";
import { applyFixedBankAllocations } from "./payslip-preview";

describe("employee bank account adapter", () => {
  it("maps fixed + remainder into the legacy payslip bank input shape", () => {
    const inputs = toPayslipBankAccountInputs({
      accounts: [
        {
          id: "a1",
          bankName: "Primary Bank",
          branchName: null,
          accountNumber: "111122223333",
          isPrimary: true,
          sortOrder: 0,
        },
        {
          id: "a2",
          bankName: "Secondary Bank",
          branchName: null,
          accountNumber: "999988887777",
          isPrimary: false,
          sortOrder: 1,
        },
      ],
      allocations: [
        {
          employeeBankAccountId: "a1",
          allocationType: "REMAINDER",
          fixedAmount: null,
          receivesRemainder: true,
          isActive: true,
        },
        {
          employeeBankAccountId: "a2",
          allocationType: "FIXED_AMOUNT",
          fixedAmount: 2_000,
          receivesRemainder: false,
          isActive: true,
        },
      ],
    });

    const { deductions, lines, primaryRemainder, warnings } =
      applyFixedBankAllocations({
        availableAfterStatutory: 10_000,
        accounts: inputs,
      });

    expect(warnings).toEqual([]);
    expect(deductions[0]?.amount).toBe(2_000);
    expect(primaryRemainder).toBe(8_000);
    expect(lines.find((line) => line.kind === "REMAINDER")?.amount).toBe(8_000);
    expect(lines.find((line) => line.kind === "FIXED")?.amount).toBe(2_000);
  });

  it("keeps netPay shape identical for single FULL_BALANCE", () => {
    const inputs = toPayslipBankAccountInputs({
      accounts: [
        {
          id: "only",
          bankName: "Only Bank",
          branchName: null,
          accountNumber: "12345678",
          isPrimary: true,
          sortOrder: 0,
        },
      ],
      allocations: [
        {
          employeeBankAccountId: "only",
          allocationType: "FULL_BALANCE",
          fixedAmount: null,
          receivesRemainder: true,
          isActive: true,
        },
      ],
    });

    const { deductions, primaryRemainder } = applyFixedBankAllocations({
      availableAfterStatutory: 5_500,
      accounts: inputs,
    });

    expect(deductions).toEqual([]);
    expect(primaryRemainder).toBe(5_500);
  });

  it("exposes setup records with last-four metadata", () => {
    const records = toPayrollBankAccountRecords({
      accounts: [
        {
          id: "a1",
          bankName: "RBL",
          branchName: null,
          accountNumber: "1234567890",
          accountNumberLastFour: "7890",
          isPrimary: true,
          sortOrder: 0,
        },
      ],
      allocations: [
        {
          employeeBankAccountId: "a1",
          allocationType: "FULL_BALANCE",
          fixedAmount: null,
          receivesRemainder: true,
          isActive: true,
        },
      ],
    });

    expect(records[0]?.accountNumberLastFour).toBe("7890");
    expect(records[0]?.isPrimary).toBe(true);
    expect(records[0]?.amount).toBeNull();
  });
});

describe("allocation validation", () => {
  const enabled = {
    splitDepositEnabled: true,
    fixedAmountEnabled: true,
    percentageEnabled: false,
    remainderEnabled: true,
  };

  it("allows single FULL_BALANCE", () => {
    expect(
      validatePayrollAllocations(
        [
          {
            allocationType: "FULL_BALANCE",
            fixedAmount: null,
            percentage: null,
            receivesRemainder: true,
          },
        ],
        enabled,
      ).ok,
    ).toBe(true);
  });

  it("rejects percentage when flag is off", () => {
    const result = validatePayrollAllocations(
      [
        {
          allocationType: "PERCENTAGE",
          fixedAmount: null,
          percentage: 25,
          receivesRemainder: false,
        },
        {
          allocationType: "REMAINDER",
          fixedAmount: null,
          percentage: null,
          receivesRemainder: true,
        },
      ],
      enabled,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/PERCENTAGE_ALLOCATION_ENABLED/);
  });

  it("when split deposit disabled, requires single FULL_BALANCE", () => {
    const drafts = bankRowsToAllocationDrafts([
      { amount: null, isPrimary: true },
      { amount: 100, isPrimary: false },
    ]);

    const result = validatePayrollAllocations(drafts, {
      ...enabled,
      splitDepositEnabled: false,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Split deposits are disabled/);
  });

  it("prefers employee accounts for readiness and falls back to legacy", () => {
    const preferred = resolveBankAccountsForReadiness({
      employeeAccounts: [
        {
          id: "eba-1",
          bankName: "FCB",
          branchName: null,
          accountNumber: "encrypted-or-plain",
          isPrimary: true,
          sortOrder: 0,
        },
      ],
      allocations: [
        {
          employeeBankAccountId: "eba-1",
          allocationType: "FULL_BALANCE",
          fixedAmount: null,
          receivesRemainder: true,
          isActive: true,
        },
      ],
      legacyAccounts: [
        {
          bankName: "Legacy Bank",
          accountNumber: "9999",
          amount: null,
          isPrimary: true,
        },
      ],
    });
    expect(preferred).toHaveLength(1);
    expect(preferred[0]?.bankName).toBe("FCB");

    const fallback = resolveBankAccountsForReadiness({
      employeeAccounts: [],
      legacyAccounts: [
        {
          bankName: "Legacy Bank",
          accountNumber: "9999",
          amount: 100,
          isPrimary: false,
        },
      ],
    });
    expect(fallback).toEqual([
      {
        bankName: "Legacy Bank",
        accountNumber: "9999",
        amount: 100,
        isPrimary: false,
      },
    ]);
  });
});

describe("ACH export feature gate", () => {
  it("documents the Phase 1 disabled default", async () => {
    const { PAYROLL_BANKING_FEATURE_DEFAULTS, PAYROLL_BANKING_FEATURE_FLAGS } =
      await import("./payroll-banking-flags");

    const ach = PAYROLL_BANKING_FEATURE_DEFAULTS.find(
      (row) =>
        row.featureCode === PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED,
    );
    const percentage = PAYROLL_BANKING_FEATURE_DEFAULTS.find(
      (row) =>
        row.featureCode ===
        PAYROLL_BANKING_FEATURE_FLAGS.PERCENTAGE_ALLOCATION_ENABLED,
    );

    expect(ach?.isEnabled).toBe(false);
    expect(percentage?.isEnabled).toBe(false);
  });
});
