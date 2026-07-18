import { describe, expect, it } from "vitest";

import {
  assembleEmployeePaymentHistory,
  assembleEmployeePaymentRoster,
  assembleMonthlyPayrollSummary,
  extractEmployerContributionFromSnapshot,
  isPeriodKeyInInclusiveRange,
  resolveDefaultMonthlyReportPeriodKey,
  resolveEmployeeHistoryPeriodRange,
  resolveEmployeePaymentHistoryScope,
  shiftMonthlyPeriodKey,
  type PostedPayslipAnalyticsRow,
} from "./payroll-analytics";

function row(
  overrides: Partial<PostedPayslipAnalyticsRow> &
    Pick<PostedPayslipAnalyticsRow, "payslipId" | "employeeId">,
): PostedPayslipAnalyticsRow {
  return {
    employeeNumber: "E001",
    employeeName: "Ada Lovelace",
    currency: "TTD",
    grossPay: 10_000,
    totalDeductions: 1_000,
    netPay: 9_000,
    employerContributions: 500,
    periodKey: "2026-06",
    periodName: "June 2026",
    periodEnd: "2026-06-30",
    payRunId: "run-1",
    runNumber: "PR-2026-06-01",
    runKind: "REGULAR",
    postedAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("extractEmployerContributionFromSnapshot", () => {
  it("sums employer contribution lines from a parsed snapshot", () => {
    const amount = extractEmployerContributionFromSnapshot({
      version: 1,
      payslip: {
        employee: {
          id: "e1",
          employeeNumber: "E001",
          displayName: "Ada",
          nisNumber: null,
          birNumber: null,
        },
        period: {
          label: "June 2026",
          asOf: "2026-06-30T12:00:00.000Z",
          payFrequency: "Monthly",
          paymentMethod: "Bank Transfer",
        },
        currency: "TTD",
        earnings: [{ label: "Base", amount: 10_000 }],
        baseSalary: 10_000,
        allowancesTotal: 0,
        grossPay: 10_000,
        monthlyTaxableEarnings: 10_000,
        deductions: [],
        totalDeductions: 0,
        netPay: 10_000,
        employerContributions: [
          { label: "NIS (employer)", amount: 1_469 },
          { label: "Other", amount: 31 },
        ],
        bankDistribution: null,
        nis: null,
        paye: null,
        health: null,
        readiness: {
          isReady: true,
          blockers: [],
          warnings: [],
        },
        warnings: [],
        notes: [],
      },
      meta: {
        organizationName: "Acme",
        jobTitle: null,
        departmentName: null,
      },
    });

    expect(amount).toBe(1_500);
  });

  it("falls back to nis.employerMonthly when lines are empty", () => {
    expect(
      extractEmployerContributionFromSnapshot({
        version: 1,
        payslip: {
          employee: {
            id: "e1",
            employeeNumber: "E001",
            displayName: "Ada",
            nisNumber: null,
            birNumber: null,
          },
          period: {
            label: "June 2026",
            asOf: "2026-06-30T12:00:00.000Z",
            payFrequency: "Monthly",
            paymentMethod: "Bank Transfer",
          },
          currency: "TTD",
          earnings: [{ label: "Base", amount: 10_000 }],
          baseSalary: 10_000,
          allowancesTotal: 0,
          grossPay: 10_000,
          monthlyTaxableEarnings: 10_000,
          deductions: [],
          totalDeductions: 0,
          netPay: 10_000,
          employerContributions: [],
          bankDistribution: [
            {
              bankName: "Primary",
              accountNumberMasked: "****1234",
              amount: 9_000,
              kind: "PRIMARY_REMAINDER",
            },
          ],
          nis: {
            classCode: "I",
            employeeWeekly: 100,
            employerWeekly: 200,
            employeeMonthly: 433.33,
            employerMonthly: 866.67,
            totalMonthly: 1_300,
            belowMinimum: false,
          },
          paye: null,
          health: null,
          readiness: {
            isReady: true,
            blockers: [],
            warnings: [],
          },
          warnings: [],
          notes: [],
        },
        meta: {
          organizationName: "Acme",
          jobTitle: null,
          departmentName: null,
        },
      }),
    ).toBe(866.67);
  });

  it("ignores bank distribution and returns 0 for empty snapshots", () => {
    expect(extractEmployerContributionFromSnapshot(null)).toBe(0);
    expect(
      extractEmployerContributionFromSnapshot({
        payslip: {
          bankDistribution: [{ amount: 5_000 }],
        },
      }),
    ).toBe(0);
  });
});

describe("period range helpers", () => {
  it("shifts monthly period keys across year boundaries", () => {
    expect(shiftMonthlyPeriodKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthlyPeriodKey("2025-12", 1)).toBe("2026-01");
    expect(shiftMonthlyPeriodKey("2026-07", -2)).toBe("2026-05");
  });

  it("treats month ranges as inclusive", () => {
    expect(isPeriodKeyInInclusiveRange("2026-03", "2026-01", "2026-06")).toBe(
      true,
    );
    expect(isPeriodKeyInInclusiveRange("2026-01", "2026-01", "2026-06")).toBe(
      true,
    );
    expect(isPeriodKeyInInclusiveRange("2026-06", "2026-01", "2026-06")).toBe(
      true,
    );
    expect(isPeriodKeyInInclusiveRange("2025-12", "2026-01", "2026-06")).toBe(
      false,
    );
    expect(isPeriodKeyInInclusiveRange("2026-07", "2026-01", "2026-06")).toBe(
      false,
    );
  });

  it("defaults the monthly report to the latest posted period", () => {
    expect(
      resolveDefaultMonthlyReportPeriodKey({
        postedPeriodKeys: ["2026-01", "2026-03", "2025-12"],
        referenceDate: new Date(Date.UTC(2026, 6, 16, 12)),
      }),
    ).toBe("2026-03");
  });

  it("falls back to the previous Trinidad month when nothing is posted", () => {
    expect(
      resolveDefaultMonthlyReportPeriodKey({
        postedPeriodKeys: [],
        referenceDate: new Date(Date.UTC(2026, 6, 16, 12)),
      }),
    ).toBe("2026-06");
  });

  it("resolves employee history presets", () => {
    const reference = new Date(Date.UTC(2026, 6, 16, 12)); // July 2026 TT

    expect(
      resolveEmployeeHistoryPeriodRange({
        preset: "this_year",
        referenceDate: reference,
      }),
    ).toEqual({
      startPeriodKey: "2026-01",
      endPeriodKey: "2026-07",
      preset: "this_year",
    });

    expect(
      resolveEmployeeHistoryPeriodRange({
        preset: "previous_year",
        referenceDate: reference,
      }),
    ).toEqual({
      startPeriodKey: "2025-01",
      endPeriodKey: "2025-12",
      preset: "previous_year",
    });

    expect(
      resolveEmployeeHistoryPeriodRange({
        preset: "last_3",
        referenceDate: reference,
      }),
    ).toEqual({
      startPeriodKey: "2026-05",
      endPeriodKey: "2026-07",
      preset: "last_3",
    });

    expect(
      resolveEmployeeHistoryPeriodRange({
        preset: "last_12",
        referenceDate: reference,
      }),
    ).toEqual({
      startPeriodKey: "2025-08",
      endPeriodKey: "2026-07",
      preset: "last_12",
    });

    expect(
      resolveEmployeeHistoryPeriodRange({
        preset: "custom",
        startPeriodKey: "2026-06",
        endPeriodKey: "2026-02",
        referenceDate: reference,
      }),
    ).toEqual({
      startPeriodKey: "2026-02",
      endPeriodKey: "2026-06",
      preset: "custom",
    });
  });
});

describe("assembleMonthlyPayrollSummary", () => {
  it("aggregates posted slips with org cost = gross + employer", () => {
    const summary = assembleMonthlyPayrollSummary({
      periodKey: "2026-06",
      periodName: "June 2026",
      rows: [
        row({
          payslipId: "p1",
          employeeId: "e1",
          grossPay: 10_000,
          totalDeductions: 1_200,
          netPay: 8_800,
          employerContributions: 500,
        }),
        row({
          payslipId: "p2",
          employeeId: "e2",
          employeeNumber: "E002",
          employeeName: "Grace Hopper",
          grossPay: 12_000.55,
          totalDeductions: 1_000.25,
          netPay: 11_000.3,
          employerContributions: 600.45,
          payRunId: "run-1",
        }),
        row({
          payslipId: "p3",
          employeeId: "e1",
          grossPay: 200,
          totalDeductions: 0,
          netPay: 200,
          employerContributions: 0,
          payRunId: "run-2",
          runNumber: "PR-2026-06-02",
          runKind: "CORRECTION",
          postedAt: "2026-07-05T12:00:00.000Z",
        }),
        // Different month — ignored
        row({
          payslipId: "p4",
          employeeId: "e3",
          periodKey: "2026-05",
          periodName: "May 2026",
        }),
      ],
    });

    expect(summary.payslipCount).toBe(3);
    expect(summary.employeeCount).toBe(2);
    expect(summary.totalsByCurrency).toEqual([
      {
        currency: "TTD",
        grossPay: 22_200.55,
        totalDeductions: 2_200.25,
        netPay: 20_000.3,
        employerContributions: 1_100.45,
        organizationCost: 23_301,
      },
    ]);

    const regular = summary.byRunKind.find((item) => item.runKind === "REGULAR");
    const correction = summary.byRunKind.find(
      (item) => item.runKind === "CORRECTION",
    );
    expect(regular?.payslipCount).toBe(2);
    expect(regular?.grossPay).toBe(22_000.55);
    expect(correction?.payslipCount).toBe(1);
    expect(correction?.grossPay).toBe(200);
    expect(summary.runs).toHaveLength(2);
  });

  it("keeps mixed currencies separate and does not add bank allocations", () => {
    const summary = assembleMonthlyPayrollSummary({
      periodKey: "2026-06",
      rows: [
        row({
          payslipId: "p1",
          employeeId: "e1",
          currency: "TTD",
          grossPay: 10_000,
          employerContributions: 400,
        }),
        row({
          payslipId: "p2",
          employeeId: "e2",
          currency: "USD",
          grossPay: 2_000,
          totalDeductions: 100,
          netPay: 1_900,
          employerContributions: 50,
        }),
      ],
    });

    expect(summary.totalsByCurrency.map((t) => t.currency)).toEqual([
      "TTD",
      "USD",
    ]);
    expect(summary.totalsByCurrency[0]?.organizationCost).toBe(10_400);
    expect(summary.totalsByCurrency[1]?.organizationCost).toBe(2_050);
  });
});

describe("assembleEmployeePaymentHistory", () => {
  it("includes corrections and builds monthly buckets with payslip links data", () => {
    const history = assembleEmployeePaymentHistory({
      employeeId: "e1",
      startPeriodKey: "2026-01",
      endPeriodKey: "2026-06",
      rows: [
        row({
          payslipId: "p1",
          employeeId: "e1",
          periodKey: "2026-01",
          periodName: "January 2026",
          payRunId: "r1",
          runNumber: "PR-2026-01-01",
          postedAt: "2026-02-01T12:00:00.000Z",
        }),
        row({
          payslipId: "p2",
          employeeId: "e1",
          periodKey: "2026-06",
          payRunId: "r2",
          runNumber: "PR-2026-06-01",
        }),
        row({
          payslipId: "p3",
          employeeId: "e1",
          periodKey: "2026-06",
          grossPay: 150,
          totalDeductions: 0,
          netPay: 150,
          employerContributions: 0,
          payRunId: "r3",
          runNumber: "PR-2026-06-02",
          runKind: "OFF_CYCLE",
          postedAt: "2026-07-10T12:00:00.000Z",
        }),
        row({
          payslipId: "p4",
          employeeId: "e2",
          periodKey: "2026-06",
        }),
        row({
          payslipId: "p5",
          employeeId: "e1",
          periodKey: "2025-12",
          periodName: "December 2025",
        }),
      ],
    });

    expect(history.payslipCount).toBe(3);
    expect(history.runCount).toBe(3);
    expect(history.totalsByCurrency[0]).toMatchObject({
      grossPay: 20_150,
      employerContributions: 1_000,
      organizationCost: 21_150,
    });
    expect(history.months).toHaveLength(2);
    expect(history.months[0]?.periodKey).toBe("2026-01");
    expect(history.months[1]?.payslips.map((p) => p.runKind)).toEqual([
      "REGULAR",
      "OFF_CYCLE",
    ]);
    expect(
      history.byRunKind.find((item) => item.runKind === "OFF_CYCLE")?.grossPay,
    ).toBe(150);
  });

  it("returns an empty history when the employee has no posted pay in range", () => {
    const history = assembleEmployeePaymentHistory({
      employeeId: "e1",
      startPeriodKey: "2026-01",
      endPeriodKey: "2026-06",
      rows: [],
    });

    expect(history.payslipCount).toBe(0);
    expect(history.months).toEqual([]);
    expect(history.totalsByCurrency).toEqual([]);
  });
});

describe("assembleEmployeePaymentRoster", () => {
  it("aggregates employees with totals, slip counts, and department names", () => {
    const departmentsByEmployeeId = new Map<string, string | null>([
      ["e1", "Engineering"],
      ["e2", "Finance"],
    ]);

    const roster = assembleEmployeePaymentRoster({
      startPeriodKey: "2026-01",
      endPeriodKey: "2026-06",
      departmentsByEmployeeId,
      rows: [
        row({
          payslipId: "p1",
          employeeId: "e1",
          employeeNumber: "E001",
          employeeName: "Ada Lovelace",
          periodKey: "2026-01",
          payRunId: "r1",
          runNumber: "PR-2026-01-01",
        }),
        row({
          payslipId: "p2",
          employeeId: "e1",
          employeeNumber: "E001",
          employeeName: "Ada Lovelace",
          periodKey: "2026-06",
          grossPay: 150,
          totalDeductions: 0,
          netPay: 150,
          employerContributions: 0,
          payRunId: "r2",
          runNumber: "PR-2026-06-02",
          runKind: "OFF_CYCLE",
        }),
        row({
          payslipId: "p3",
          employeeId: "e2",
          employeeNumber: "E002",
          employeeName: "Grace Hopper",
          periodKey: "2026-06",
          grossPay: 8_000,
          totalDeductions: 800,
          netPay: 7_200,
          employerContributions: 400,
          payRunId: "r3",
          runNumber: "PR-2026-06-01",
        }),
        row({
          payslipId: "p4",
          employeeId: "e1",
          employeeNumber: "E001",
          employeeName: "Ada Lovelace",
          periodKey: "2025-12",
        }),
      ],
    });

    expect(roster.payslipCount).toBe(3);
    expect(roster.employeeCount).toBe(2);
    expect(roster.runCount).toBe(3);
    expect(roster.totalsByCurrency[0]).toMatchObject({
      grossPay: 18_150,
      totalDeductions: 1_800,
      netPay: 16_350,
      employerContributions: 900,
      organizationCost: 19_050,
    });
    expect(roster.employees).toHaveLength(2);
    expect(roster.employees[0]).toMatchObject({
      employeeId: "e1",
      employeeName: "Ada Lovelace",
      departmentName: "Engineering",
      payslipCount: 2,
    });
    expect(roster.employees[0]?.totalsByCurrency[0]).toMatchObject({
      grossPay: 10_150,
      netPay: 9_150,
    });
    expect(roster.employees[1]).toMatchObject({
      employeeId: "e2",
      departmentName: "Finance",
      payslipCount: 1,
    });
    expect(
      roster.byRunKind.find((item) => item.runKind === "OFF_CYCLE")?.grossPay,
    ).toBe(150);
  });

  it("returns an empty roster when there are no posted slips in range", () => {
    const roster = assembleEmployeePaymentRoster({
      startPeriodKey: "2026-01",
      endPeriodKey: "2026-06",
      rows: [],
    });

    expect(roster.employeeCount).toBe(0);
    expect(roster.payslipCount).toBe(0);
    expect(roster.employees).toEqual([]);
    expect(roster.totalsByCurrency).toEqual([]);
  });
});

describe("resolveEmployeePaymentHistoryScope", () => {
  it("defaults to all employees", () => {
    expect(resolveEmployeePaymentHistoryScope(null)).toBe("all");
    expect(resolveEmployeePaymentHistoryScope("bogus")).toBe("all");
  });

  it("preserves employee deep links without an explicit scope", () => {
    expect(
      resolveEmployeePaymentHistoryScope(undefined, { employeeId: "e1" }),
    ).toBe("employee");
  });

  it("accepts explicit scopes", () => {
    expect(resolveEmployeePaymentHistoryScope("department")).toBe("department");
    expect(resolveEmployeePaymentHistoryScope("employee")).toBe("employee");
    expect(resolveEmployeePaymentHistoryScope("all")).toBe("all");
  });
});
