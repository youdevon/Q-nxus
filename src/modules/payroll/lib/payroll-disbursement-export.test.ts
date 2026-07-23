import { describe, expect, it } from "vitest";

import {
  buildPayrollDisbursementCsv,
  buildPayrollDisbursementRows,
  buildPayrollDisbursementRowsFromPayslips,
  buildPayrollDisbursementXlsx,
  PAYROLL_DISBURSEMENT_SCHEMA_VERSION,
  summarizePayrollDisbursementRows,
} from "@/src/modules/payroll/lib/payroll-disbursement-export";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";

const runMeta = {
  runNumber: "PR-100",
  periodKey: "2026-07",
  periodEnd: "2026-07-31",
  paymentDate: "2026-07-31",
};

function minimalPayslip(
  bankDistribution: PayslipPreview["bankDistribution"],
): PayslipPreview {
  return {
    employee: {
      id: "emp-1",
      employeeNumber: "E001",
      displayName: "Ada Lovelace",
      nisNumber: "NIS-1",
      birNumber: "BIR-1",
    },
    period: {
      label: "2026-07",
      asOf: "2026-07-31",
      payFrequency: "MONTHLY",
      paymentMethod: "BANK_TRANSFER",
    },
    currency: "TTD",
    earnings: [],
    baseSalary: 10_000,
    allowancesTotal: 0,
    grossPay: 10_000,
    monthlyTaxableEarnings: 10_000,
    deductions: [],
    totalDeductions: 2_000,
    netPay: 8_000,
    employerContributions: [],
    bankDistribution,
  } as unknown as PayslipPreview;
}

describe("buildPayrollDisbursementRows", () => {
  it("emits one row per positive allocation and skips zero amounts", () => {
    const rows = buildPayrollDisbursementRows({
      run: runMeta,
      employees: [
        {
          employeeNumber: "E001",
          employeeName: "Ada",
          nisNumber: "NIS-1",
          birNumber: "BIR-1",
          currency: "TTD",
          grossPay: 10_000,
          paye: 1_200,
          nisEmployee: 500,
          healthSurcharge: 82.5,
          netPay: 8_000,
          allocations: [
            {
              bankName: "Primary",
              branchName: "POS",
              accountNumber: "1111",
              accountName: "Ada",
              accountType: "SAVINGS",
              splitType: "REMAINDER",
              allocationAmount: 6_000,
            },
            {
              bankName: "Secondary",
              branchName: null,
              accountNumber: "2222",
              accountName: null,
              accountType: "CHEQUING",
              splitType: "FIXED",
              allocationAmount: 2_000,
            },
            {
              bankName: "Skip",
              accountNumber: "0000",
              splitType: "FIXED",
              allocationAmount: 0,
            },
          ],
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.schemaVersion).toBe(PAYROLL_DISBURSEMENT_SCHEMA_VERSION);
    expect(rows[0]?.accountType).toBe("SAVINGS");
    expect(rows[1]?.accountType).toBe("CHEQUING");
    expect(rows[0]?.allocationAmount).toBe(6_000);
    expect(rows[0]?.paye).toBe(1_200);
    expect(rows[0]?.bankName).toBe("Primary");
    expect(rows[1]?.bankName).toBe("Secondary");
    expect(rows.every((row) => row.employeeNumber === "E001")).toBe(true);
  });

  it("builds rows from payslip bankDistribution with payroll columns", () => {
    const rows = buildPayrollDisbursementRowsFromPayslips({
      run: runMeta,
      rows: [
        {
          employeeNumber: "E001",
          employeeName: "Ada",
          currency: "TTD",
          grossPay: 10_000,
          paye: 1_200,
          nisEmployee: 500,
          healthSurcharge: 82.5,
          netPay: 8_000,
          payslip: minimalPayslip([
            {
              bankName: "Live",
              accountNumber: "9999",
              accountNumberMasked: "••••9999",
              amount: 8_000,
              kind: "REMAINDER",
              accountType: "SAVINGS",
            },
          ]),
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.bankName).toBe("Live");
    expect(rows[0]?.nisNumber).toBe("NIS-1");
    expect(rows[0]?.grossPay).toBe(10_000);
    expect(rows[0]?.allocationAmount).toBe(8_000);
    expect(rows[0]?.accountType).toBe("SAVINGS");
  });

  it("summarizes unique employees and allocation totals", () => {
    const rows = buildPayrollDisbursementRows({
      run: runMeta,
      employees: [
        {
          employeeNumber: "E001",
          employeeName: "Ada",
          currency: "TTD",
          grossPay: 10_000,
          paye: 0,
          nisEmployee: 0,
          healthSurcharge: 0,
          netPay: 8_000,
          allocations: [
            {
              bankName: "A",
              accountNumber: "1",
              splitType: "FIXED",
              allocationAmount: 3_000,
            },
            {
              bankName: "B",
              accountNumber: "2",
              splitType: "REMAINDER",
              allocationAmount: 5_000,
            },
          ],
        },
      ],
    });

    expect(summarizePayrollDisbursementRows(rows)).toEqual({
      employeeCount: 1,
      allocationCount: 2,
      totalAllocationAmount: 8_000,
      totalNetPay: 8_000,
    });
  });

  it("writes schema v1 CSV headers", () => {
    const rows = buildPayrollDisbursementRows({
      run: runMeta,
      employees: [
        {
          employeeNumber: "E001",
          employeeName: "Ada",
          currency: "TTD",
          grossPay: 1,
          paye: 0,
          nisEmployee: 0,
          healthSurcharge: 0,
          netPay: 1,
          allocations: [
            {
              bankName: "Bank",
              accountNumber: "123",
              splitType: "REMAINDER",
              allocationAmount: 1,
            },
          ],
        },
      ],
    });
    const csv = buildPayrollDisbursementCsv(rows);
    expect(csv.split("\n")[0]).toContain("schemaVersion");
    expect(csv).toContain("allocationAmount");
    expect(csv).toContain("grossPay");
  });

  it("builds a non-empty xlsx buffer (Office Open XML zip)", async () => {
    const rows = buildPayrollDisbursementRows({
      run: runMeta,
      employees: [
        {
          employeeNumber: "E001",
          employeeName: "Ada",
          currency: "TTD",
          grossPay: 10_000,
          paye: 100,
          nisEmployee: 50,
          healthSurcharge: 10,
          netPay: 9_840,
          allocations: [
            {
              bankName: "FCB",
              accountNumber: "111122223333",
              splitType: "REMAINDER",
              allocationAmount: 9_840,
            },
          ],
        },
      ],
    });

    const buffer = await buildPayrollDisbursementXlsx(rows);
    expect(buffer.byteLength).toBeGreaterThan(500);
    // XLSX is a ZIP package — local file header signature "PK"
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
