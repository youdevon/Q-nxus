import { describe, expect, it } from "vitest";

import {
  bankFixedAmountTotal,
  evaluatePayrollReadiness,
} from "./payroll-readiness";

const achReady = {
  accountHolderName: "Ada Lovelace",
  accountType: "SAVINGS" as const,
};

describe("evaluatePayrollReadiness", () => {
  it("is ready with primary remainder and fixed secondary amounts", () => {
    const result = evaluatePayrollReadiness({
      hasCurrentContract: true,
      baseSalary: 8000,
      nisNumber: "NIS-1",
      birNumber: "BIR-1",
      paymentMethod: "BANK_TRANSFER",
      bankAccounts: [
        {
          bankName: "RBL",
          accountNumber: "123",
          amount: null,
          isPrimary: true,
          ...achReady,
        },
        {
          bankName: "RBC",
          accountNumber: "456",
          amount: 1500,
          isPrimary: false,
          ...achReady,
        },
      ],
    });

    expect(result.isReady).toBe(true);
    expect(result.blockingIssues).toEqual([]);
  });

  it("flags missing NIS/BIR, missing primary, and invalid secondary amounts", () => {
    const result = evaluatePayrollReadiness({
      hasCurrentContract: true,
      baseSalary: 8000,
      nisNumber: null,
      birNumber: "",
      paymentMethod: "BANK_TRANSFER",
      bankAccounts: [
        {
          bankName: "RBL",
          accountNumber: "123",
          amount: 0,
          isPrimary: false,
          ...achReady,
        },
        {
          bankName: "RBC",
          accountNumber: "456",
          amount: 500,
          isPrimary: false,
          ...achReady,
        },
      ],
    });

    expect(result.isReady).toBe(false);
    expect(result.blockingIssues).toEqual(
      expect.arrayContaining([
        "NIS number missing.",
        "BIR number missing.",
        "Exactly one payment instruction must be marked as primary (remainder).",
        "Each secondary payment instruction needs a fixed amount greater than zero.",
      ]),
    );
  });

  it("accepts a single primary remainder account with no fixed amount", () => {
    const result = evaluatePayrollReadiness({
      hasCurrentContract: true,
      baseSalary: 5000,
      nisNumber: "NIS-1",
      birNumber: "BIR-1",
      paymentMethod: "BANK_TRANSFER",
      bankAccounts: [
        {
          bankName: "RBL",
          accountNumber: "123",
          amount: null,
          isPrimary: true,
          ...achReady,
        },
      ],
    });

    expect(result.isReady).toBe(true);
  });

  it("blocks bank transfer without ACH account holder or account type", () => {
    const result = evaluatePayrollReadiness({
      hasCurrentContract: true,
      baseSalary: 5000,
      nisNumber: "NIS-1",
      birNumber: "BIR-1",
      paymentMethod: "BANK_TRANSFER",
      bankAccounts: [
        {
          bankName: "RBL",
          accountNumber: "123",
          amount: null,
          isPrimary: true,
        },
      ],
    });

    expect(result.isReady).toBe(false);
    expect(result.blockingIssues).toEqual(
      expect.arrayContaining([
        "Each payment instruction needs an account holder name (ACH Individual Name).",
        "Each payment instruction needs account type Savings or Chequing (ACH Payment Type).",
      ]),
    );
  });

  it("does not require banks for cash payment", () => {
    const result = evaluatePayrollReadiness({
      hasCurrentContract: true,
      baseSalary: 5000,
      nisNumber: "NIS-1",
      birNumber: "BIR-1",
      paymentMethod: "CASH",
      bankAccounts: [],
    });

    expect(result.isReady).toBe(true);
  });

  it("skips NIS number when exempt from NIS", () => {
    const result = evaluatePayrollReadiness({
      hasCurrentContract: true,
      baseSalary: 5000,
      nisNumber: null,
      birNumber: "BIR-1",
      paymentMethod: "CASH",
      bankAccounts: [],
      exemptFromNis: true,
    });

    expect(result.isReady).toBe(true);
    expect(result.blockingIssues).toEqual([]);
  });

  it("skips BIR number when exempt from PAYE", () => {
    const result = evaluatePayrollReadiness({
      hasCurrentContract: true,
      baseSalary: 5000,
      nisNumber: "NIS-1",
      birNumber: null,
      paymentMethod: "CASH",
      bankAccounts: [],
      exemptFromPaye: true,
    });

    expect(result.isReady).toBe(true);
    expect(result.blockingIssues).toEqual([]);
  });

  it("still requires BIR when only NIS-exempt", () => {
    const result = evaluatePayrollReadiness({
      hasCurrentContract: true,
      baseSalary: 5000,
      nisNumber: null,
      birNumber: null,
      paymentMethod: "CASH",
      bankAccounts: [],
      exemptFromNis: true,
    });

    expect(result.isReady).toBe(false);
    expect(result.blockingIssues).toEqual(["BIR number missing."]);
  });
});

describe("bankFixedAmountTotal", () => {
  it("sums secondary amounts and ignores primary remainder", () => {
    expect(
      bankFixedAmountTotal([
        { amount: null, isPrimary: true },
        { amount: 1000.5, isPrimary: false },
        { amount: 499.5, isPrimary: false },
      ]),
    ).toBe(1500);
  });
});
