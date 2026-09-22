import { describe, expect, it } from "vitest";

import {
  aggregateStatutoryRemittance,
  extractStatutoryRemittanceRow,
} from "./statutory-remittance";

function snapshotFixture(input: {
  paye?: number;
  nisEmployee?: number;
  nisEmployer?: number;
  health?: number;
}) {
  return {
    version: 1,
    payslip: {
      employee: { id: "e1", employeeNumber: "E001", displayName: "Ada" },
      period: {
        label: "July 2026",
        asOf: "2026-07-31",
        payFrequency: "Monthly",
        paymentMethod: "Bank Transfer",
      },
      currency: "TTD",
      earnings: [],
      baseSalary: 10_000,
      allowancesTotal: 0,
      grossPay: 10_000,
      monthlyTaxableEarnings: 10_000,
      deductions: [
        ...(input.paye != null
          ? [{ label: "PAYE (income tax)", amount: input.paye }]
          : []),
        ...(input.nisEmployee != null
          ? [{ label: "NIS (employee)", amount: input.nisEmployee }]
          : []),
        ...(input.health != null
          ? [{ label: "Health Surcharge", amount: input.health }]
          : []),
      ],
      totalDeductions: 0,
      netPay: 0,
      employerContributions: [
        ...(input.nisEmployer != null
          ? [{ label: "NIS (employer)", amount: input.nisEmployer }]
          : []),
      ],
      bankDistribution: null,
      nis: null,
      paye: null,
      health: null,
      readiness: { isReady: true, blockingIssues: [] },
      warnings: [],
      notes: [],
    },
    meta: { organizationName: "Acme", jobTitle: null, departmentName: null },
  };
}

describe("extractStatutoryRemittanceRow", () => {
  it("pulls PAYE, NIS employee/employer, and Health from a posted snapshot", () => {
    const row = extractStatutoryRemittanceRow(
      snapshotFixture({
        paye: 450.25,
        nisEmployee: 120.5,
        nisEmployer: 240.75,
        health: 20,
      }),
      "TTD",
    );

    expect(row).toEqual({
      currency: "TTD",
      paye: 450.25,
      nisEmployee: 120.5,
      nisEmployer: 240.75,
      health: 20,
    });
  });

  it("defaults missing lines to zero and falls back to TTD currency", () => {
    const row = extractStatutoryRemittanceRow(snapshotFixture({}), "");

    expect(row).toEqual({
      currency: "TTD",
      paye: 0,
      nisEmployee: 0,
      nisEmployer: 0,
      health: 0,
    });
  });

  it("returns zeros for an unparseable snapshot", () => {
    const row = extractStatutoryRemittanceRow({ garbage: true }, "TTD");
    expect(row).toEqual({
      currency: "TTD",
      paye: 0,
      nisEmployee: 0,
      nisEmployer: 0,
      health: 0,
    });
  });

  it("reads Class Z employer lines from a posted snapshot", () => {
    const row = extractStatutoryRemittanceRow(
      {
        version: 1,
        payslip: {
          ...snapshotFixture({}).payslip,
          employerContributions: [
            { label: "NIS Class Z (employer)", amount: 101.72 },
          ],
          nis: {
            category: "CLASS_Z",
            classZEmployerMonthly: 101.72,
            employerMonthly: 0,
          },
        },
        meta: snapshotFixture({}).meta,
      },
      "TTD",
    );

    expect(row.nisEmployer).toBe(101.72);
  });
});

describe("aggregateStatutoryRemittance", () => {
  it("sums rows per currency and computes totalRemittance", () => {
    const totals = aggregateStatutoryRemittance([
      { currency: "TTD", paye: 100, nisEmployee: 50, nisEmployer: 60, health: 10 },
      { currency: "TTD", paye: 200, nisEmployee: 75, nisEmployer: 90, health: 15 },
      { currency: "USD", paye: 40, nisEmployee: 5, nisEmployer: 6, health: 1 },
    ]);

    expect(totals).toEqual([
      {
        currency: "TTD",
        paye: 300,
        nisEmployee: 125,
        nisEmployer: 150,
        health: 25,
        totalRemittance: 600,
      },
      {
        currency: "USD",
        paye: 40,
        nisEmployee: 5,
        nisEmployer: 6,
        health: 1,
        totalRemittance: 52,
      },
    ]);
  });

  it("returns an empty array for no rows", () => {
    expect(aggregateStatutoryRemittance([])).toEqual([]);
  });

  it("is cent-exact when summing fractional amounts", () => {
    const totals = aggregateStatutoryRemittance([
      { currency: "TTD", paye: 0.1, nisEmployee: 0.2, nisEmployer: 0, health: 0 },
      { currency: "TTD", paye: 0.2, nisEmployee: 0.1, nisEmployer: 0, health: 0 },
    ]);

    expect(totals[0]!.paye).toBe(0.3);
    expect(totals[0]!.nisEmployee).toBe(0.3);
  });
});
