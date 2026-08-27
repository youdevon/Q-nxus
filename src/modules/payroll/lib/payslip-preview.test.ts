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
  notesForPayslipDisplay,
  payslipLineDetailForDisplay,
  PAYSLIP_PREVIEW_CAVEAT_NOTES,
  payslipPeriodToAsOfDate,
  resolveDefaultLivePayslipPeriod,
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

  it("defaults live preview to the current month when coverage starts after the previous month", () => {
    expect(
      resolveDefaultLivePayslipPeriod({
        referenceDate: new Date(Date.UTC(2026, 6, 17, 12)),
        coverageStartDate: "2026-07-01",
      }),
    ).toBe("2026-07");
    expect(
      resolveDefaultLivePayslipPeriod({
        referenceDate: new Date(Date.UTC(2026, 6, 17, 12)),
        coverageStartDate: "2026-06-02",
      }),
    ).toBe("2026-06");
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
        accountNumber: "999988887777",
        accountNumberMasked: "••••7777",
        amount: 2_000,
        kind: "FIXED",
      accountType: null,
      },
      {
        bankName: "Primary Bank",
        accountNumber: "111122223333",
        accountNumberMasked: "••••3333",
        amount: 8_000,
        kind: "REMAINDER",
      accountType: null,
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
        accountNumber: "999988887777",
        accountNumberMasked: "••••7777",
        amount: 2_000,
        kind: "FIXED",
      accountType: null,
      },
      {
        bankName: "Primary Bank",
        accountNumber: "111122223333",
        accountNumberMasked: "••••3333",
        amount: 8_000,
        kind: "REMAINDER",
      accountType: null,
      },
    ]);
  });
});

describe("notesForPayslipDisplay", () => {
  it("keeps preview caveats for live previews", () => {
    const notes = [
      ...PAYSLIP_PREVIEW_CAVEAT_NOTES,
      "NIS: earnings below Class I floor — no employee contribution.",
    ];

    expect(notesForPayslipDisplay(notes, false)).toEqual(notes);
  });

  it("strips preview caveats from posted slips but keeps factual notes", () => {
    const notes = [
      ...PAYSLIP_PREVIEW_CAVEAT_NOTES,
      "NIS: earnings below Class I floor — no employee contribution.",
      "Health Surcharge exempt (age).",
    ];

    expect(notesForPayslipDisplay(notes, true)).toEqual([
      "NIS: earnings below Class I floor — no employee contribution.",
      "Health Surcharge exempt (age).",
    ]);
  });
});

describe("payslipLineDetailForDisplay", () => {
  it("hides override and internal PAYE estimate details", () => {
    expect(
      payslipLineDetailForDisplay(
        "Override · August 2026 in-house payroll worksheet — master PAYE applied to remaining open periods.",
      ),
    ).toBeNull();
    expect(payslipLineDetailForDisplay("Tax-year estimate 1482.44")).toBeNull();
    expect(
      payslipLineDetailForDisplay("Class XVI · 169.50/wk × 5"),
    ).toBe("Class XVI · 169.50/wk × 5");
  });
});

describe("assemblePayslipPreview", () => {
  it("computes TTD 30,000 monthly stub: NIS by Mondays, PAYE 5,496.46, Health by contribution weeks", () => {
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

    // July 2026 has 4 Mondays → NIS weekly × 4
    expect(preview.nis?.classCode).toBe("XVI");
    expect(preview.nis?.weeksInPeriod).toBe(4);
    expect(preview.nis?.employeeMonthly).toBe(678);
    expect(preview.nis?.employerMonthly).toBe(1_356);

    expect(preview.paye?.monthlyPaye).toBe(5_496.46);
    expect(preview.health?.periodAmount).toBe(33);
    expect(preview.health?.weeksInPeriod).toBe(4);

    const statutoryTotal = 678 + 5_496.46 + 33;

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
        amount: 1_356,
      }),
    ]);

    expect(preview.bankDistribution).toEqual([
      {
        bankName: "Unit Trust",
        accountNumber: "99887766",
        accountNumberMasked: "••••7766",
        amount: 500,
        kind: "FIXED",
      accountType: null,
      },
      {
        bankName: "Republic Bank",
        accountNumber: "1234567890",
        accountNumberMasked: "••••7890",
        amount: preview.netPay,
        kind: "REMAINDER",
      accountType: null,
      },
    ]);
  });

  it("uses 5 Mondays for August 2026 NIS and Health amounts", () => {
    const preview = assemblePayslipPreview({
      employee: {
        id: "emp-aug",
        employeeNumber: "E-108",
        displayName: "August Example",
        dateOfBirth: "1990-01-15",
      },
      currency: "TTD",
      payFrequency: "MONTHLY",
      paymentMethod: "CASH",
      asOf: new Date("2026-08-15T12:00:00.000Z"),
      earnings: [
        {
          label: "Base salary",
          amount: 30_000,
          frequency: "Monthly",
          isTaxable: true,
          source: "CONTRACT_SALARY",
        },
      ],
      bankAccounts: [],
      readiness: { isReady: true, blockingIssues: [] },
      nisClasses: TT_NIS_2026_CLASSES,
      payeConfig: TT_PAYE_2026_CONFIG,
      healthConfig: TT_HEALTH_SURCHARGE_2026,
    });

    expect(preview.period.label).toBe("August 2026");
    expect(preview.nis?.weeksInPeriod).toBe(5);
    expect(preview.nis?.employeeMonthly).toBe(847.5);
    expect(preview.nis?.employerMonthly).toBe(1_695);
    expect(preview.health?.weeksInPeriod).toBe(5);
    expect(preview.health?.periodAmount).toBe(41.25);
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

  it("keeps non-taxable allowances in gross pay but excludes them from taxable pay", () => {
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

  it("includes taxable contract allowances in NIS/PAYE/Health taxable pay", () => {
    const preview = assemblePayslipPreview({
      employee: {
        id: "emp-3b",
        employeeNumber: "E-301",
        displayName: "Taxable Allowance",
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
          label: "Housing",
          amount: 2_000,
          frequency: "Monthly",
          isTaxable: true,
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
    expect(preview.monthlyTaxableEarnings).toBe(30_000);
    expect(preview.paye?.annualTaxableIncome).toBe(360_000);
    expect(preview.nis).not.toBeNull();
    expect(preview.health).not.toBeNull();
  });

  it("includes taxable variable earnings and variable deductions", () => {
    const preview = assemblePayslipPreview({
      employee: {
        id: "emp-4",
        employeeNumber: "E-400",
        displayName: "Taylor Variable",
        dateOfBirth: "1985-06-01",
      },
      currency: "TTD",
      payFrequency: "MONTHLY",
      paymentMethod: "CHEQUE",
      asOf: new Date("2026-07-16T12:00:00.000Z"),
      earnings: [
        {
          label: "Base salary",
          amount: 10_000,
          frequency: "Monthly",
          isTaxable: true,
          source: "CONTRACT_SALARY",
        },
        {
          label: "Overtime",
          amount: 1_500,
          frequency: "Monthly",
          isTaxable: true,
          source: "VARIABLE_EARNING",
          detail: "overtime",
        },
      ],
      deductions: [
        {
          label: "Correction deduction",
          amount: 250,
          detail: "manual adjustment",
        },
      ],
      bankAccounts: [],
      readiness: { isReady: true, blockingIssues: [] },
      nisClasses: TT_NIS_2026_CLASSES,
      payeConfig: TT_PAYE_2026_CONFIG,
      healthConfig: TT_HEALTH_SURCHARGE_2026,
    });

    expect(preview.grossPay).toBe(11_500);
    expect(preview.monthlyTaxableEarnings).toBe(11_500);
    expect(preview.earnings.map((line) => line.label)).toContain("Overtime");
    expect(preview.deductions.map((line) => line.label)).toContain(
      "Correction deduction",
    );
  });

  it("zeros NIS, PAYE, and Health when employee is opted out", () => {
    const preview = assemblePayslipPreview({
      employee: {
        id: "emp-exempt",
        employeeNumber: "E-EX",
        displayName: "Exempt Person",
        dateOfBirth: "1990-01-15",
        nisNumber: null,
        birNumber: null,
      },
      currency: "TTD",
      payFrequency: "MONTHLY",
      paymentMethod: "CASH",
      asOf: new Date("2026-07-16T12:00:00.000Z"),
      earnings: [
        {
          label: "Base salary",
          amount: 30_000,
          frequency: "Monthly",
          isTaxable: true,
          source: "CONTRACT_SALARY",
        },
      ],
      bankAccounts: [],
      readiness: { isReady: true, blockingIssues: [] },
      exemptFromNis: true,
      exemptFromPaye: true,
      exemptFromHealthSurcharge: true,
      nisClasses: TT_NIS_2026_CLASSES,
      payeConfig: TT_PAYE_2026_CONFIG,
      healthConfig: TT_HEALTH_SURCHARGE_2026,
    });

    expect(preview.nis).toBeNull();
    expect(preview.paye).toBeNull();
    expect(preview.health?.exempt).toBe(true);
    expect(preview.health?.exemptionReason).toBe("EMPLOYEE_OPT_OUT");
    expect(preview.health?.periodAmount).toBe(0);
    expect(preview.employerContributions).toEqual([]);
    expect(preview.deductions.map((line) => line.label)).toEqual([]);
    expect(preview.netPay).toBe(30_000);
    expect(preview.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("NIS exempt"),
        expect.stringContaining("PAYE exempt"),
        expect.stringContaining("employee opt out"),
      ]),
    );
  });
});
