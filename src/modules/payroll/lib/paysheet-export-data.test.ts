import { describe, expect, it } from "vitest";

import {
  extractBankRowsFromSnapshot,
  extractNisWeeklyFromSnapshot,
} from "./paysheet-export-data";
import { buildPayslipSnapshot } from "./payslip-snapshot";

describe("extractNisWeeklyFromSnapshot", () => {
  it("returns Class Z weekly employer rate", () => {
    const snapshot = buildPayslipSnapshot(
      {
        employee: {
          id: "e1",
          employeeNumber: "12",
          displayName: "Ursula Nedd-Duke",
          nisNumber: null,
          birNumber: null,
        },
        period: {
          label: "August 2026",
          asOf: "2026-08-31",
          payFrequency: "Monthly",
          paymentMethod: "Bank Transfer",
        },
        currency: "TTD",
        earnings: [],
        baseSalary: 4700,
        allowancesTotal: 0,
        grossPay: 4700,
        monthlyTaxableEarnings: 4700,
        deductions: [],
        totalDeductions: 0,
        netPay: 4700,
        employerContributions: [
          { label: "NIS Class Z (employer)", amount: 41.6 },
        ],
        bankDistribution: null,
        nis: {
          classCode: "Z",
          employeeWeekly: 0,
          employerWeekly: 0,
          employeeMonthly: 0,
          employerMonthly: 0,
          totalMonthly: 41.6,
          weeksInPeriod: 5,
          belowMinimum: false,
          category: "CLASS_Z",
          classZEmployerMonthly: 41.6,
          classZEmployerWeekly: 8.32,
          classZCalculatedEmployerMonthly: 41.6,
          classZOverrideApplied: false,
          eligibilityReason: "Class Z",
          transitionAlert: null,
        },
        paye: null,
        health: null,
        readiness: { isReady: true, blockingIssues: [] },
        warnings: [],
        notes: [],
      },
      { organizationName: "Acme", jobTitle: null, departmentName: null },
    );

    expect(extractNisWeeklyFromSnapshot(snapshot)).toEqual({
      classLabel: "Z",
      weeksInPeriod: 5,
      employeeWeekly: 0,
      employerWeekly: 8.32,
    });
  });

  it("returns normal class weekly rates", () => {
    const snapshot = buildPayslipSnapshot(
      {
        employee: {
          id: "e1",
          employeeNumber: "19",
          displayName: "Devon Dumas",
          nisNumber: null,
          birNumber: null,
        },
        period: {
          label: "August 2026",
          asOf: "2026-08-31",
          payFrequency: "Monthly",
          paymentMethod: "Bank Transfer",
        },
        currency: "TTD",
        earnings: [],
        baseSalary: 30000,
        allowancesTotal: 0,
        grossPay: 30000,
        monthlyTaxableEarnings: 30000,
        deductions: [{ label: "NIS (employee)", amount: 847.5 }],
        totalDeductions: 847.5,
        netPay: 29152.5,
        employerContributions: [
          { label: "NIS (employer)", amount: 1695 },
        ],
        bankDistribution: null,
        nis: {
          classCode: "XVI",
          employeeWeekly: 169.5,
          employerWeekly: 339,
          employeeMonthly: 847.5,
          employerMonthly: 1695,
          totalMonthly: 2542.5,
          weeksInPeriod: 5,
          belowMinimum: false,
          category: "NORMAL",
          classZEmployerMonthly: 0,
          classZEmployerWeekly: 0,
          classZCalculatedEmployerMonthly: 0,
          classZOverrideApplied: false,
          eligibilityReason: "Normal",
          transitionAlert: null,
        },
        paye: null,
        health: null,
        readiness: { isReady: true, blockingIssues: [] },
        warnings: [],
        notes: [],
      },
      { organizationName: "Acme", jobTitle: null, departmentName: null },
    );

    expect(extractNisWeeklyFromSnapshot(snapshot)).toEqual({
      classLabel: "XVI",
      weeksInPeriod: 5,
      employeeWeekly: 169.5,
      employerWeekly: 339,
    });
  });
});

describe("extractBankRowsFromSnapshot", () => {
  it("maps bank distribution lines", () => {
    const snapshot = buildPayslipSnapshot(
      {
        employee: {
          id: "e1",
          employeeNumber: "11",
          displayName: "Ada Lovelace",
          nisNumber: null,
          birNumber: null,
        },
        period: {
          label: "August 2026",
          asOf: "2026-08-31",
          payFrequency: "Monthly",
          paymentMethod: "Bank Transfer",
        },
        currency: "TTD",
        earnings: [],
        baseSalary: 3500,
        allowancesTotal: 0,
        grossPay: 3500,
        monthlyTaxableEarnings: 3500,
        deductions: [],
        totalDeductions: 0,
        netPay: 3500,
        employerContributions: [],
        bankDistribution: [
          {
            bankName: "Republic Bank",
            accountNumberMasked: "****1234",
            accountNumber: "1234567890",
            amount: 3500,
            kind: "REMAINDER",
            accountType: "SAVINGS",
          },
        ],
        nis: null,
        paye: null,
        health: null,
        readiness: { isReady: true, blockingIssues: [] },
        warnings: [],
        notes: [],
      },
      { organizationName: "Acme", jobTitle: null, departmentName: null },
    );

    const rows = extractBankRowsFromSnapshot(snapshot, {
      employeeNumber: "11",
      employeeName: "Ada Lovelace",
      netPay: 3500,
    });

    expect(rows).toEqual([
      {
        employeeNumber: "11",
        employeeName: "Ada Lovelace",
        bankName: "Republic Bank",
        accountNumber: "1234567890",
        accountType: "SAVINGS",
        splitType: "Remainder",
        amount: 3500,
      },
    ]);
  });
});
