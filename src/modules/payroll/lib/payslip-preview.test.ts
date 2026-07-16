import { describe, expect, it } from "vitest";

import { TT_HEALTH_SURCHARGE_2026 } from "./health-surcharge";
import { TT_NIS_2026_CLASSES } from "./nis-seed-data";
import { TT_PAYE_2026_CONFIG } from "./paye-contribution";
import {
  applyFixedBankAllocations,
  assemblePayslipPreview,
  distributeNetToBanks,
  formatPayslipPeriodLabel,
  getPreviousPayslipPeriod,
  maskAccountNumber,
  payslipPeriodToAsOfDate,
  toMonthlyPeriodAmount,
} from "./payslip-preview";

describe("toMonthlyPeriodAmount", () => {
  it("passes monthly amounts through", () => {
    expect(toMonthlyPeriodAmount(30_000, "Monthly")).toBe(30_000);
    expect(toMonthlyPeriodAmount(500, "MONTHLY")).toBe(500);
  });

  it("annualises weekly and biweekly allowances", () => {
    expect(toMonthlyPeriodAmount(100, "WEEKLY")).toBe(
      Math.round(((100 * 52) / 12) * 100) / 100,
    );
    expect(toMonthlyPeriodAmount(200, "BIWEEKLY")).toBe(
      Math.round(((200 * 26) / 12) * 100) / 100,
    );
  });

  it("skips one-time amounts", () => {
    expect(toMonthlyPeriodAmount(5_000, "ONE_TIME")).toBe(0);
  });
});

describe("maskAccountNumber", () => {
  it("masks all but the last four digits", () => {
    expect(maskAccountNumber("1234567890")).toBe("••••7890");
  });
});

describe("payslip periods", () => {
  it("uses the previous Trinidad calendar month", () => {
    expect(getPreviousPayslipPeriod(new Date(Date.UTC(2026, 6, 16, 12)))).toBe(
      "2026-06",
    );
    expect(getPreviousPayslipPeriod(new Date(Date.UTC(2026, 0, 5, 12)))).toBe(
      "2025-12",
    );
  });

  it("parses a period as the end of that month", () => {
    expect(payslipPeriodToAsOfDate("2026-06")?.toISOString()).toBe(
      "2026-06-30T12:00:00.000Z",
    );
    expect(payslipPeriodToAsOfDate("2026-13")).toBeNull();
  });

  it("formats period labels for the payslip title", () => {
    expect(formatPayslipPeriodLabel("2026-06")).toBe("June 2026");
  });
});

describe("applyFixedBankAllocations", () => {
  it("treats secondary fixed amounts as deductions and remainder to primary", () => {
    const { deductions, lines, primaryRemainder, warnings } =
      applyFixedBankAllocations({
        availableAfterStatutory: 10_000,
        accounts: [
          {
            bankName: "Primary Bank",
            accountNumber: "111122223333",
            amount: null,
            isPrimary: true,
          },
          {
            bankName: "Secondary Bank",
            accountNumber: "999988887777",
            amount: 2_000,
            isPrimary: false,
          },
        ],
      });

    expect(warnings).toEqual([]);
    expect(deductions).toEqual([
      {
        label: "Bank transfer — Secondary Bank",
        amount: 2_000,
        detail: "••••7777",
      },
    ]);
    expect(primaryRemainder).toBe(8_000);
    expect(lines).toEqual([
      {
        bankName: "Secondary Bank",
        accountNumberMasked: "••••7777",
        amount: 2_000,
        kind: "FIXED",
      },
      {
        bankName: "Primary Bank",
        accountNumberMasked: "••••3333",
        amount: 8_000,
        kind: "REMAINDER",
      },
    ]);
  });

  it("clamps when fixed amounts exceed available pay", () => {
    const { deductions, lines, primaryRemainder, warnings } =
      applyFixedBankAllocations({
        availableAfterStatutory: 1_000,
        accounts: [
          {
            bankName: "Primary Bank",
            accountNumber: "1111",
            amount: null,
            isPrimary: true,
          },
          {
            bankName: "Secondary Bank",
            accountNumber: "2222",
            amount: 1_500,
            isPrimary: false,
          },
        ],
      });

    expect(warnings.length).toBe(1);
    expect(deductions[0]?.amount).toBe(1_000);
    expect(lines.find((line) => line.kind === "FIXED")?.amount).toBe(1_000);
    expect(primaryRemainder).toBe(0);
    expect(lines.find((line) => line.kind === "REMAINDER")?.amount).toBe(0);
  });
});

describe("distributeNetToBanks", () => {
  it("delegates to applyFixedBankAllocations", () => {
    const { lines, warnings } = distributeNetToBanks({
      netPay: 10_000,
      accounts: [
        {
          bankName: "Primary Bank",
          accountNumber: "111122223333",
          amount: null,
          isPrimary: true,
        },
        {
          bankName: "Secondary Bank",
          accountNumber: "999988887777",
          amount: 2_000,
          isPrimary: false,
        },
      ],
    });

    expect(warnings).toEqual([]);
    expect(lines).toEqual([
      {
        bankName: "Secondary Bank",
        accountNumberMasked: "••••7777",
        amount: 2_000,
        kind: "FIXED",
      },
      {
        bankName: "Primary Bank",
        accountNumberMasked: "••••3333",
        amount: 8_000,
        kind: "REMAINDER",
      },
    ]);
  });
});

describe("assemblePayslipPreview", () => {
  it("computes TTD 30,000 monthly stub: NIS 734.50, PAYE 5,496.46, Health 35.75", () => {
    const preview = assemblePayslipPreview({
      employee: {
        id: "emp-1",
        employeeNumber: "E-100",
        displayName: "Alex Example",
        dateOfBirth: "1990-01-15",
        nisNumber: "NIS-123456",
        birNumber: "BIR-789012",
      },
      currency: "TTD",
      payFrequency: "MONTHLY",
      paymentMethod: "BANK_TRANSFER",
      asOf: new Date("2026-07-16T12:00:00.000Z"),
      earnings: [
        {
          label: "Base salary — Engineer",
          amount: 30_000,
          frequency: "Monthly",
          isTaxable: true,
          source: "CONTRACT_SALARY",
        },
      ],
      bankAccounts: [
        {
          bankName: "Republic Bank",
          accountNumber: "1234567890",
          amount: null,
          isPrimary: true,
        },
        {
          bankName: "Unit Trust",
          accountNumber: "99887766",
          amount: 500,
          isPrimary: false,
        },
      ],
      readiness: { isReady: true, blockingIssues: [] },
      nisClasses: TT_NIS_2026_CLASSES,
      payeConfig: TT_PAYE_2026_CONFIG,
      healthConfig: TT_HEALTH_SURCHARGE_2026,
    });

    expect(preview.employee.nisNumber).toBe("NIS-123456");
    expect(preview.employee.birNumber).toBe("BIR-789012");

    expect(preview.period.label).toBe("July 2026");
    expect(preview.baseSalary).toBe(30_000);
    expect(preview.allowancesTotal).toBe(0);
    expect(preview.grossPay).toBe(30_000);
    expect(preview.monthlyTaxableEarnings).toBe(30_000);

    expect(preview.nis?.classCode).toBe("XVI");
    expect(preview.nis?.employeeMonthly).toBe(734.5);
    expect(preview.nis?.employerMonthly).toBe(1_469);

    expect(preview.paye?.monthlyPaye).toBe(5_496.46);
    expect(preview.health?.averageMonthlyAmount).toBe(35.75);

    const statutoryTotal = 734.5 + 5_496.46 + 35.75;

    expect(preview.totalDeductions).toBe(statutoryTotal + 500);
    expect(preview.netPay).toBe(
      Math.round((30_000 - statutoryTotal - 500) * 100) / 100,
    );

    expect(preview.deductions.map((line) => line.label)).toEqual([
      "NIS (employee)",
      "PAYE (income tax)",
      "Health Surcharge",
      "Bank transfer — Unit Trust",
    ]);

    expect(preview.deductions.find((line) => line.label.includes("Unit Trust")))
      .toEqual(
        expect.objectContaining({
          amount: 500,
          detail: "••••7766",
        }),
      );

    expect(preview.employerContributions).toEqual([
      expect.objectContaining({
        label: "NIS (employer)",
        amount: 1_469,
      }),
    ]);

    expect(preview.bankDistribution).toEqual([
      {
        bankName: "Unit Trust",
        accountNumberMasked: "••••7766",
        amount: 500,
        kind: "FIXED",
      },
      {
        bankName: "Republic Bank",
        accountNumberMasked: "••••7890",
        amount: preview.netPay,
        kind: "REMAINDER",
      },
    ]);
  });

  it("warns when fixed bank deductions exceed pay after statutory", () => {
    const preview = assemblePayslipPreview({
      employee: {
        id: "emp-over",
        employeeNumber: "E-999",
        displayName: "Over Allocated",
        dateOfBirth: "1990-01-15",
      },
      currency: "TTD",
      payFrequency: "MONTHLY",
      paymentMethod: "BANK_TRANSFER",
      earnings: [
        {
          label: "Base salary",
          amount: 5_000,
          frequency: "Monthly",
          isTaxable: true,
          source: "CONTRACT_SALARY",
        },
      ],
      bankAccounts: [
        {
          bankName: "Primary Bank",
          accountNumber: "1111",
          amount: null,
          isPrimary: true,
        },
        {
          bankName: "Secondary Bank",
          accountNumber: "2222",
          amount: 6_000,
          isPrimary: false,
        },
      ],
      readiness: { isReady: true, blockingIssues: [] },
      nisClasses: TT_NIS_2026_CLASSES,
      payeConfig: TT_PAYE_2026_CONFIG,
      healthConfig: TT_HEALTH_SURCHARGE_2026,
    });

    expect(preview.netPay).toBeGreaterThanOrEqual(0);
    expect(
      preview.warnings.some((warning) =>
        warning.includes("Secondary bank fixed amounts"),
      ),
    ).toBe(true);
    expect(
      preview.bankDistribution?.find((line) => line.kind === "REMAINDER")
        ?.amount,
    ).toBe(preview.netPay);
  });

  it("still builds a partial payslip when statutory configs are missing", () => {
    const preview = assemblePayslipPreview({
      employee: {
        id: "emp-2",
        employeeNumber: "E-200",
        displayName: "Jordan Incomplete",
      },
      currency: "TTD",
      payFrequency: "MONTHLY",
      paymentMethod: "CASH",
      earnings: [
        {
          label: "Base salary",
          amount: 10_000,
          frequency: "Monthly",
          isTaxable: true,
          source: "CONTRACT_SALARY",
        },
      ],
      bankAccounts: [],
      readiness: {
        isReady: false,
        blockingIssues: ["NIS number missing."],
      },
      nisClasses: [],
      payeConfig: null,
      healthConfig: null,
    });

    expect(preview.grossPay).toBe(10_000);
    expect(preview.deductions).toEqual([]);
    expect(preview.netPay).toBe(10_000);
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        "NIS number missing.",
        "No active NIS earnings classes configured.",
        "No active PAYE tax config configured.",
        "No active Health Surcharge config configured.",
      ]),
    );
  });

  it("keeps allowances in gross pay but excludes them from taxable pay", () => {
    const preview = assemblePayslipPreview({
      employee: {
        id: "emp-3",
        employeeNumber: "E-300",
        displayName: "Sam Allowance",
        dateOfBirth: "1985-06-01",
      },
      currency: "TTD",
      payFrequency: "MONTHLY",
      paymentMethod: "CHEQUE",
      asOf: new Date("2026-07-16T12:00:00.000Z"),
      earnings: [
        {
          label: "Base salary",
          amount: 28_000,
          frequency: "Monthly",
          isTaxable: true,
          source: "CONTRACT_SALARY",
        },
        {
          label: "Travel",
          amount: 2_000,
          frequency: "Monthly",
          isTaxable: false,
          source: "CONTRACT_ALLOWANCE",
        },
      ],
      bankAccounts: [],
      readiness: { isReady: true, blockingIssues: [] },
      nisClasses: TT_NIS_2026_CLASSES,
      payeConfig: TT_PAYE_2026_CONFIG,
      healthConfig: TT_HEALTH_SURCHARGE_2026,
    });

    expect(preview.baseSalary).toBe(28_000);
    expect(preview.allowancesTotal).toBe(2_000);
    expect(preview.grossPay).toBe(30_000);
    expect(preview.monthlyTaxableEarnings).toBe(28_000);
    expect(preview.paye?.annualTaxableIncome).toBe(336_000);
    expect(preview.paye?.monthlyPaye).toBe(4_996.46);
  });
});
