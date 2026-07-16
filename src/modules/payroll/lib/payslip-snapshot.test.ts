import { describe, expect, it } from "vitest";

import {
  buildMonthlyPeriodBounds,
  defaultMonthlyPeriodKey,
  parseMonthlyPeriodKey,
} from "./pay-period";
import {
  buildPayslipSnapshot,
  extractPayslipSnapshotTotals,
  parsePayslipSnapshot,
  sumPayRunTotals,
} from "./payslip-snapshot";
import type { PayslipPreview } from "./payslip-preview";

const samplePayslip: PayslipPreview = {
  employee: {
    id: "emp-1",
    employeeNumber: "EMP-00001",
    displayName: "Ada Lovelace",
    nisNumber: "1234567",
    birNumber: "BIR-1",
  },
  period: {
    label: "June 2026",
    asOf: "2026-06-30T12:00:00.000Z",
    payFrequency: "MONTHLY",
    paymentMethod: "BANK_TRANSFER",
  },
  currency: "TTD",
  earnings: [{ label: "Base Salary", amount: 10_000 }],
  baseSalary: 10_000,
  allowancesTotal: 0,
  grossPay: 10_000,
  monthlyTaxableEarnings: 10_000,
  deductions: [{ label: "NIS", amount: 500 }],
  totalDeductions: 500,
  netPay: 9_500,
  employerContributions: [],
  bankDistribution: [
    {
      bankName: "RBC",
      accountNumberMasked: "••••1234",
      amount: 9_500,
      kind: "REMAINDER",
    },
  ],
  nis: null,
  paye: null,
  health: null,
  readiness: { isReady: true, blockingIssues: [] },
  warnings: [],
  notes: [],
};

const sampleMeta = {
  organizationName: "Acme Ltd",
  jobTitle: "Engineer",
  departmentName: "Engineering",
};

describe("pay-period", () => {
  it("parses monthly period keys", () => {
    expect(parseMonthlyPeriodKey("2026-07")).toEqual({
      year: 2026,
      month: 7,
    });
    expect(parseMonthlyPeriodKey("2026-13")).toBeNull();
  });

  it("builds Trinidad monthly bounds ending on last day of month", () => {
    const bounds = buildMonthlyPeriodBounds("2026-06");
    expect(bounds).not.toBeNull();
    expect(bounds?.year).toBe(2026);
    expect(bounds?.month).toBe(6);
    expect(bounds?.periodKey).toBe("2026-06");
    expect(bounds?.periodStart.toISOString()).toBe(
      "2026-06-01T12:00:00.000Z",
    );
    expect(bounds?.periodEnd.toISOString()).toBe("2026-06-30T12:00:00.000Z");
    expect(bounds?.name).toContain("2026");
  });

  it("defaults period key to current Trinidad month", () => {
    expect(defaultMonthlyPeriodKey(new Date("2026-07-16T16:00:00.000Z"))).toBe(
      "2026-07",
    );
  });
});

describe("payslip-snapshot", () => {
  it("round-trips a frozen snapshot without recalculation", () => {
    const snapshot = buildPayslipSnapshot(samplePayslip, sampleMeta);
    const parsed = parsePayslipSnapshot(snapshot);

    expect(parsed).toEqual(snapshot);
    expect(parsed?.payslip.netPay).toBe(9_500);
    expect(parsed?.meta.organizationName).toBe("Acme Ltd");
  });

  it("rejects malformed snapshots", () => {
    expect(parsePayslipSnapshot(null)).toBeNull();
    expect(parsePayslipSnapshot({ version: 2 })).toBeNull();
    expect(
      parsePayslipSnapshot({
        version: 1,
        payslip: { ...samplePayslip, grossPay: "nope" },
        meta: sampleMeta,
      }),
    ).toBeNull();
  });

  it("extracts denormalized totals for pay-run rows", () => {
    const totals = extractPayslipSnapshotTotals(samplePayslip, sampleMeta);
    expect(totals).toMatchObject({
      grossPay: 10_000,
      totalDeductions: 500,
      netPay: 9_500,
      employeeNumber: "EMP-00001",
      employeeName: "Ada Lovelace",
      jobTitle: "Engineer",
    });
  });

  it("sums pay-run totals with money rounding", () => {
    expect(
      sumPayRunTotals([
        { grossPay: 10_000.105, totalDeductions: 100.1, netPay: 9_900.005 },
        { grossPay: 5_000.1, totalDeductions: 50.05, netPay: 4_950.05 },
      ]),
    ).toEqual({
      employeeCount: 2,
      totalGross: 15_000.21,
      totalDeductions: 150.15,
      totalNet: 14_850.06,
    });
  });

  it("preserves posted amounts when live values would differ", () => {
    const frozen = buildPayslipSnapshot(samplePayslip, sampleMeta);
    const liveWouldBe = {
      ...samplePayslip,
      baseSalary: 12_000,
      grossPay: 12_000,
      netPay: 11_500,
    };

    const restored = parsePayslipSnapshot(frozen);
    expect(restored?.payslip.grossPay).toBe(10_000);
    expect(restored?.payslip.netPay).toBe(9_500);
    expect(liveWouldBe.netPay).not.toBe(restored?.payslip.netPay);
  });
});
