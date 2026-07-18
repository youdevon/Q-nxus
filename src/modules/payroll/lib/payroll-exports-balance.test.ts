import { describe, expect, it } from "vitest";

import {
  compareParallelPayroll,
  parseTrustedPayrollCsv,
} from "@/src/modules/payroll/lib/parallel-payroll-compare";
import { buildGlJournalLines } from "@/src/modules/payroll/lib/payroll-exports";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";

function stubPayslip(input: {
  gross: number;
  net: number;
  deductions: Array<{ label: string; amount: number }>;
  employerNis?: number;
}): PayslipPreview {
  return {
    employee: {
      id: "e1",
      employeeNumber: "E001",
      displayName: "Test",
      dateOfBirth: null,
      nisNumber: null,
      birNumber: null,
    },
    period: { label: "2026-01", start: "2026-01-01", end: "2026-01-31" },
    currency: "TTD",
    payFrequency: "MONTHLY",
    paymentMethod: "BANK_TRANSFER",
    baseSalary: input.gross,
    allowancesTotal: 0,
    grossPay: input.gross,
    monthlyTaxableEarnings: input.gross,
    totalDeductions: input.deductions.reduce((s, d) => s + d.amount, 0),
    netPay: input.net,
    earnings: [],
    deductions: input.deductions.map((d) => ({
      label: d.label,
      amount: d.amount,
    })),
    employerContributions:
      input.employerNis != null
        ? [{ label: "NIS (employer)", amount: input.employerNis }]
        : [],
    bankDistribution: null,
    readiness: { isReady: true, blockingIssues: [] },
    warnings: [],
    notes: [],
    nis: null,
    paye: null,
    health: null,
  } as unknown as PayslipPreview;
}

describe("buildGlJournalLines", () => {
  it("balances when other deductions exist", () => {
    const payslip = stubPayslip({
      gross: 10_000,
      net: 7_000,
      deductions: [
        { label: "NIS (employee)", amount: 500 },
        { label: "PAYE (income tax)", amount: 1_000 },
        { label: "Health Surcharge", amount: 50 },
        { label: "Bank transfer — Credit Union", amount: 1_450 },
      ],
      employerNis: 1_000,
    });

    const journal = buildGlJournalLines({
      rows: [
        {
          currency: "TTD",
          grossPay: 10_000,
          netPay: 7_000,
          payslip,
        },
      ],
    });

    expect(journal.totalDebit).toBe(journal.totalCredit);
    expect(journal.totalDebit).toBe(11_000);
  });
});

describe("parallel payroll compare", () => {
  it("parses trusted CSV and reports cent diffs", () => {
    const trusted = parseTrustedPayrollCsv(`employeeNumber,grossPay,totalDeductions,netPay
E001,10000,3000,7000
E002,8000,2000,6000`);

    const result = compareParallelPayroll({
      trusted,
      qnxus: [
        {
          employeeNumber: "E001",
          grossPay: 10000,
          totalDeductions: 3000,
          netPay: 7000.01,
        },
        {
          employeeNumber: "E002",
          grossPay: 8000,
          totalDeductions: 2000,
          netPay: 6000,
        },
      ],
    });

    expect(result.matchedEmployees).toBe(2);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.field).toBe("netPay");
    expect(result.diffs[0]?.deltaCents).toBe(-1);
  });
});
