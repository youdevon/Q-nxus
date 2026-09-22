import { describe, expect, it } from "vitest";

import {
  assemblePayrollRegisterDocument,
  type PayrollRegisterSourceRow,
} from "./payroll-register-document";

function slip(
  overrides: Partial<PayrollRegisterSourceRow> &
    Pick<PayrollRegisterSourceRow, "employeeId" | "employeeName">,
): PayrollRegisterSourceRow {
  return {
    employeeNumber: "E001",
    departmentName: "Ops",
    jobTitle: "Clerk",
    currency: "TTD",
    baseSalary: 1000,
    allowancesTotal: 100,
    grossPay: 1100,
    paye: 50,
    nisEmployee: 40,
    healthSurcharge: 10,
    otherDeductions: 0,
    totalDeductions: 100,
    netPay: 1000,
    nisEmployer: 40,
    nisPayment: 80,
    periodKey: "2026-01",
    periodName: "January 2026",
    runNumber: "PR-1",
    runKind: "REGULAR",
    postedAt: "2026-01-31T00:00:00.000Z",
    ...overrides,
  };
}

describe("assemblePayrollRegisterDocument", () => {
  it("auto-calculates one row per employee across the period", () => {
    const register = assemblePayrollRegisterDocument({
      rows: [
        slip({
          employeeId: "a",
          employeeName: "Ada",
          employeeNumber: "A1",
          grossPay: 1100,
          netPay: 1000,
          nisEmployer: 40,
          nisPayment: 80,
        }),
        slip({
          employeeId: "a",
          employeeName: "Ada",
          employeeNumber: "A1",
          periodKey: "2026-02",
          periodName: "February 2026",
          runNumber: "PR-2",
          grossPay: 1100,
          netPay: 1000,
          nisEmployer: 40,
          nisPayment: 80,
        }),
        slip({
          employeeId: "b",
          employeeName: "Bea",
          employeeNumber: "B1",
          grossPay: 2200,
          netPay: 2000,
          baseSalary: 2000,
          allowancesTotal: 200,
          paye: 100,
          nisEmployee: 80,
          healthSurcharge: 20,
          totalDeductions: 200,
          nisEmployer: 80,
          nisPayment: 160,
        }),
      ],
    });

    expect(register.mode).toBe("employee");
    expect(register.employeeCount).toBe(2);
    expect(register.payslipCount).toBe(3);
    expect(register.rows).toHaveLength(2);
    expect(register.rows[0]).toMatchObject({
      employeeName: "Ada",
      payslipCount: 2,
      grossPay: 2200,
      netPay: 2000,
      nisPayment: 160,
    });
    expect(register.totals.grossPay).toBe(4400);
    expect(register.totals.netPay).toBe(4000);
  });

  it("keeps slip-level rows for a single employee", () => {
    const register = assemblePayrollRegisterDocument({
      rows: [
        slip({ employeeId: "a", employeeName: "Ada", runNumber: "PR-1" }),
        slip({
          employeeId: "a",
          employeeName: "Ada",
          periodKey: "2026-02",
          periodName: "February 2026",
          runNumber: "PR-2",
        }),
      ],
    });

    expect(register.mode).toBe("slip");
    expect(register.rows).toHaveLength(2);
    expect(register.rows[0]?.runNumber).toBe("PR-1");
    expect(register.totals.grossPay).toBe(2200);
  });
});
