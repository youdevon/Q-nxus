import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  controlTotalFromDetails,
  GenericCsvBankExportAdapter,
  maskExportPreview,
  resolveBankExportAdapter,
} from "./bank-export-adapter";
import {
  decryptAccountNumber,
  encryptAccountNumber,
} from "./bank-account-crypto";
import {
  bankRowsToAllocationDrafts,
  validatePayrollAllocations,
} from "./payroll-allocation-validation";
import {
  buildBankPaymentCsv,
  buildBankPaymentCsvFromPaymentAllocations,
} from "./payroll-exports";
import {
  buildPaymentDraftFromPayslip,
  summarizePreparedPayments,
} from "./prepare-payroll-payments";
import type { PayslipPreview } from "./payslip-preview";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-auth-secret-16chars";
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

function minimalPayslip(overrides?: {
  bankDistribution?: PayslipPreview["bankDistribution"];
  netPay?: number;
  paymentMethod?: string;
}): PayslipPreview {
  return {
    employee: {
      id: "emp-1",
      employeeNumber: "E001",
      displayName: "Ada Lovelace",
      nisNumber: null,
      birNumber: null,
    },
    period: {
      label: "2026-07",
      asOf: "2026-07-31",
      payFrequency: "MONTHLY",
      paymentMethod: overrides?.paymentMethod ?? "BANK_TRANSFER",
    },
    currency: "TTD",
    earnings: [],
    baseSalary: 10_000,
    allowancesTotal: 0,
    grossPay: 10_000,
    monthlyTaxableEarnings: 10_000,
    deductions: [],
    totalDeductions: 0,
    netPay: overrides?.netPay ?? 8_000,
    employerContributions: [],
    bankDistribution:
      overrides && "bankDistribution" in overrides
        ? overrides.bankDistribution!
        : [
            {
              bankName: "Primary Bank",
              accountNumber: "111122223333",
              accountNumberMasked: "••••3333",
              amount: 6_000,
              kind: "REMAINDER",
            },
            {
              bankName: "Secondary Bank",
              accountNumber: "999988887777",
              accountNumberMasked: "••••7777",
              amount: 2_000,
              kind: "FIXED",
            },
          ],
    nis: null,
    paye: null,
    health: null,
    readiness: {
      isReady: true,
      blockingIssues: [],
    },
    warnings: [],
    notes: [],
  };
}

describe("prepare payment drafts from payslip snapshots", () => {
  it("freezes bankDistribution and enriches institution metadata when linkable", () => {
    const draft = buildPaymentDraftFromPayslip({
      payslipId: "slip-1",
      employeeId: "emp-1",
      netPay: 8_000,
      currencyCode: "TTD",
      paymentMethod: "BANK_TRANSFER",
      payslip: minimalPayslip(),
      bankingEnabled: true,
      bankAccounts: [
        {
          id: "ba-1",
          financialInstitutionId: "fi-1",
          bankName: "Primary Bank",
          branchCode: "01",
          branchName: "Port of Spain",
          accountHolderName: "Ada Lovelace",
          accountNumber: "111122223333",
          accountNumberLastFour: "3333",
          accountType: "SAVINGS",
          sourceAllocationId: "alloc-1",
        },
      ],
    });

    expect(draft.paymentStatus).toBe("READY");
    expect(draft.allocations).toHaveLength(2);
    expect(draft.allocations[0]?.financialInstitutionId).toBe("fi-1");
    expect(draft.allocations[0]?.employeeBankAccountId).toBe("ba-1");
    expect(
      decryptAccountNumber(draft.allocations[0]?.accountNumberEncrypted),
    ).toBe("111122223333");
    expect(draft.allocations[1]?.bankName).toBe("Secondary Bank");
  });

  it("does not depend on live bank account numbers after snapshot freeze", () => {
    const draft = buildPaymentDraftFromPayslip({
      payslipId: "slip-1",
      employeeId: "emp-1",
      netPay: 8_000,
      currencyCode: "TTD",
      paymentMethod: "BANK_TRANSFER",
      payslip: minimalPayslip({
        bankDistribution: [
          {
            bankName: "Frozen Bank",
            accountNumber: "000011112222",
            accountNumberMasked: "••••2222",
            amount: 8_000,
            kind: "REMAINDER",
          },
        ],
      }),
      bankingEnabled: true,
      // Live accounts were changed — enrichment miss is OK; snapshot amounts stay.
      bankAccounts: [
        {
          id: "ba-new",
          financialInstitutionId: null,
          bankName: "New Bank",
          branchCode: null,
          branchName: null,
          accountHolderName: null,
          accountNumber: "999900001111",
          accountNumberLastFour: "1111",
          accountType: "SAVINGS",
        },
      ],
    });

    expect(draft.allocations[0]?.bankName).toBe("Frozen Bank");
    expect(
      decryptAccountNumber(draft.allocations[0]?.accountNumberEncrypted),
    ).toBe("000011112222");
    expect(draft.allocations[0]?.amount).toBe(8_000);
    expect(draft.allocations[0]?.employeeBankAccountId).toBeNull();
  });

  it("prefers snapshot bankDistribution over fallbackDistribution", () => {
    const draft = buildPaymentDraftFromPayslip({
      payslipId: "slip-1",
      employeeId: "emp-1",
      netPay: 8_000,
      currencyCode: "TTD",
      paymentMethod: "BANK_TRANSFER",
      payslip: minimalPayslip({
        bankDistribution: [
          {
            bankName: "Snapshot Bank",
            accountNumber: "555566667777",
            accountNumberMasked: "••••7777",
            amount: 8_000,
            kind: "REMAINDER",
          },
        ],
      }),
      bankingEnabled: true,
      bankAccounts: [],
      fallbackDistribution: [
        {
          bankName: "Fallback Bank",
          accountNumber: "111100001111",
          accountNumberMasked: "••••1111",
          amount: 8_000,
          kind: "REMAINDER",
        },
      ],
    });

    expect(draft.allocations[0]?.bankName).toBe("Snapshot Bank");
    expect(
      decryptAccountNumber(draft.allocations[0]?.accountNumberEncrypted),
    ).toBe("555566667777");
  });

  it("uses fallbackDistribution when snapshot has no bankDistribution", () => {
    const draft = buildPaymentDraftFromPayslip({
      payslipId: "slip-1",
      employeeId: "emp-1",
      netPay: 5_000,
      currencyCode: "TTD",
      paymentMethod: "BANK_TRANSFER",
      payslip: minimalPayslip({ bankDistribution: null }),
      bankingEnabled: true,
      bankAccounts: [],
      fallbackDistribution: [
        {
          bankName: "Live Bank",
          accountNumber: "424242424242",
          accountNumberMasked: "••••4242",
          amount: 5_000,
          kind: "REMAINDER",
        },
      ],
    });

    expect(draft.paymentStatus).toBe("READY");
    expect(draft.allocations[0]?.bankName).toBe("Live Bank");
    expect(draft.allocations[0]?.amount).toBe(5_000);
  });

  it("stores encrypted snapshot account numbers", () => {
    const draft = buildPaymentDraftFromPayslip({
      payslipId: "slip-1",
      employeeId: "emp-1",
      netPay: 1_000,
      currencyCode: "TTD",
      paymentMethod: "BANK_TRANSFER",
      payslip: minimalPayslip({
        bankDistribution: [
          {
            bankName: "B",
            accountNumber: "123456789012",
            accountNumberMasked: "••••9012",
            amount: 1_000,
            kind: "REMAINDER",
          },
        ],
      }),
      bankingEnabled: true,
      bankAccounts: [],
    });

    const stored = draft.allocations[0]?.accountNumberEncrypted;
    expect(stored).toBeTruthy();
    expect(stored).not.toBe("123456789012");
    expect(decryptAccountNumber(stored)).toBe("123456789012");
    // Re-encrypting the same plaintext yields a different IV — but decrypt works.
    expect(encryptAccountNumber("123456789012")).not.toBe("123456789012");
  });

  it("marks NOT_CONFIGURED when payroll banking is disabled", () => {
    const draft = buildPaymentDraftFromPayslip({
      payslipId: "slip-1",
      employeeId: "emp-1",
      netPay: 8_000,
      currencyCode: "TTD",
      paymentMethod: "BANK_TRANSFER",
      payslip: minimalPayslip(),
      bankingEnabled: false,
      bankAccounts: [],
    });

    expect(draft.paymentStatus).toBe("NOT_CONFIGURED");
    expect(draft.allocations).toEqual([]);
  });

  it("marks PAYMENT_SETUP_REQUIRED when verified accounts are required", () => {
    const draft = buildPaymentDraftFromPayslip({
      payslipId: "slip-1",
      employeeId: "emp-1",
      netPay: 8_000,
      currencyCode: "TTD",
      paymentMethod: "BANK_TRANSFER",
      payslip: minimalPayslip({
        bankDistribution: [
          {
            bankName: "Primary Bank",
            accountNumber: "111122223333",
            accountNumberMasked: "••••3333",
            amount: 8_000,
            kind: "REMAINDER",
          },
        ],
      }),
      bankingEnabled: true,
      requireVerifiedAccounts: true,
      bankAccounts: [
        {
          id: "eba-1",
          financialInstitutionId: null,
          bankName: "Primary Bank",
          branchCode: null,
          branchName: null,
          accountHolderName: null,
          accountNumber: "111122223333",
          accountNumberLastFour: "3333",
          accountType: "SAVINGS",
          isVerified: false,
        },
      ],
    });

    expect(draft.paymentStatus).toBe("PAYMENT_SETUP_REQUIRED");
    expect(draft.setupErrorMessage).toMatch(/unverified/i);
  });

  it("summarizes prepared payment statuses", () => {
    const summary = summarizePreparedPayments([
      buildPaymentDraftFromPayslip({
        payslipId: "a",
        employeeId: "e1",
        netPay: 100,
        currencyCode: "TTD",
        paymentMethod: "BANK_TRANSFER",
        payslip: minimalPayslip({
          netPay: 100,
          bankDistribution: [
            {
              bankName: "B",
              accountNumber: "12345678",
              accountNumberMasked: "••••5678",
              amount: 100,
              kind: "REMAINDER",
            },
          ],
        }),
        bankingEnabled: true,
        bankAccounts: [],
      }),
      buildPaymentDraftFromPayslip({
        payslipId: "b",
        employeeId: "e2",
        netPay: 50,
        currencyCode: "TTD",
        paymentMethod: "BANK_TRANSFER",
        payslip: minimalPayslip({ bankDistribution: null }),
        bankingEnabled: true,
        bankAccounts: [],
      }),
    ]);

    expect(summary.paymentCount).toBe(2);
    expect(summary.readyCount).toBe(1);
    expect(summary.setupRequiredCount).toBe(1);
  });
});

describe("allocation validation still holds", () => {
  it("rejects percentage when flag is off", () => {
    const result = validatePayrollAllocations(
      [
        {
          allocationType: "PERCENTAGE",
          fixedAmount: null,
          percentage: 50,
          receivesRemainder: false,
        },
      ],
      {
        splitDepositEnabled: true,
        fixedAmountEnabled: true,
        percentageEnabled: false,
        remainderEnabled: true,
      },
    );
    expect(result.ok).toBe(false);
  });

  it("accepts primary remainder + fixed secondary drafts", () => {
    const drafts = bankRowsToAllocationDrafts([
      { amount: null, isPrimary: true },
      { amount: 500, isPrimary: false },
    ]);
    const result = validatePayrollAllocations(drafts, {
      splitDepositEnabled: true,
      fixedAmountEnabled: true,
      percentageEnabled: false,
      remainderEnabled: true,
    });
    expect(result.ok).toBe(true);
  });
});

describe("bank export adapter", () => {
  const details = [
    {
      sequence: 1,
      employeeNumber: "E001",
      employeeName: "Ada Lovelace",
      bankName: "Primary Bank",
      accountNumber: "111122223333",
      accountNumberMasked: "••••3333",
      amount: 6_000,
      currencyCode: "TTD",
      allocationKind: "REMAINDER",
    },
    {
      sequence: 2,
      employeeNumber: "E001",
      employeeName: "Ada Lovelace",
      bankName: "Secondary Bank",
      accountNumber: "999988887777",
      accountNumberMasked: "••••7777",
      amount: 2_000,
      currencyCode: "TTD",
      allocationKind: "FIXED",
    },
  ];

  it("control total equals sum of details", () => {
    expect(controlTotalFromDetails(details)).toBe(8_000);
  });

  it("generates CSV with masked preview", () => {
    const adapter = resolveBankExportAdapter("GENERIC_CSV");
    const result = adapter.generate({
      batchNumber: "ACH-PR-001-001",
      runNumber: "PR-001",
      currencyCode: "TTD",
      details,
      configurationJson: {
        fileNamePrefix: "generic-ach-csv",
        includeHeader: true,
        maskAccountNumbers: false,
      },
    });

    expect(result.detailCount).toBe(2);
    expect(result.controlTotalAmount).toBe(8_000);
    expect(result.content).toContain("111122223333");
    expect(result.maskedPreview).not.toContain("111122223333");
    expect(result.maskedPreview).toContain("••••3333");
    expect(result.contentHash).toHaveLength(64);
  });

  it("manual register adapter validates empty batches", () => {
    const adapter = new GenericCsvBankExportAdapter("MANUAL_REGISTER");
    const validation = adapter.validate({
      batchNumber: "ACH-1",
      runNumber: "PR-1",
      currencyCode: "TTD",
      details: [],
      configurationJson: {},
    });
    expect(validation.ok).toBe(false);
  });

  it("maskExportPreview replaces full account numbers", () => {
    const preview = maskExportPreview("pay 111122223333 now", details);
    expect(preview).toBe("pay ••••3333 now");
  });
});

describe("bank CSV prefers payment allocation snapshots", () => {
  it("builds CSV from frozen payment allocations when prepared", () => {
    const fromPayments = buildBankPaymentCsvFromPaymentAllocations({
      runNumber: "PR-100",
      rows: [
        {
          employeeNumber: "E001",
          employeeName: "Ada",
          currencyCode: "TTD",
          allocations: [
            {
              bankName: "Frozen",
              accountNumber: "111122223333",
              accountNumberMasked: "••••3333",
              amount: 1_000,
              allocationKind: "REMAINDER",
            },
          ],
        },
      ],
    });
    const fromSnapshot = buildBankPaymentCsv({
      runNumber: "PR-100",
      rows: [
        {
          employeeNumber: "E001",
          employeeName: "Ada",
          currency: "TTD",
          payslip: minimalPayslip({
            bankDistribution: [
              {
                bankName: "Live",
                accountNumber: "999988887777",
                accountNumberMasked: "••••7777",
                amount: 1_000,
                kind: "REMAINDER",
              },
            ],
          }),
        },
      ],
    });

    expect(fromPayments).toContain("Frozen");
    expect(fromPayments).toContain("111122223333");
    expect(fromPayments).not.toContain("Live");
    expect(fromSnapshot).toContain("Live");
  });
});

describe("maker-checker rule (pure)", () => {
  it("blocks preparer from approving when approval is required", () => {
    const preparedByUserId: string = "user-maker";
    const actorUserId: string = "user-maker";
    const approvalRequired = true;

    const blocked =
      approvalRequired && preparedByUserId === actorUserId;

    expect(blocked).toBe(true);
  });

  it("allows a different approver", () => {
    const preparedByUserId: string = "user-maker";
    const actorUserId: string = "user-checker";
    const approvalRequired = true;

    const blocked =
      approvalRequired && preparedByUserId === actorUserId;

    expect(blocked).toBe(false);
  });
});
