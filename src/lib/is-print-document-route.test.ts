import { describe, expect, it } from "vitest";

import { isPrintDocumentRoute } from "@/src/lib/is-print-document-route";

describe("isPrintDocumentRoute", () => {
  it.each([
    "/me/payslip/print",
    "/payroll/print/ready",
    "/payroll/employees/abc/payslip/print",
    "/payroll/employees/abc/tax-year/print",
    "/payroll/runs/abc/print",
    "/payroll/runs/abc/paysheet/print",
    "/payroll/runs/abc/payslips/xyz/print",
    "/payroll/reports/monthly/print",
    "/people/employees/abc/documents/print",
    "/people/employees/abc/payroll/payslip/print",
    "/reports/payroll/readiness/print",
    "/reports/people/leave-balances/print",
    "/administration/audit/print",
    "/administration/audit/print/extra",
  ])("treats %s as a print document route", (pathname) => {
    expect(isPrintDocumentRoute(pathname)).toBe(true);
  });

  it.each([
    "/me/payslip",
    "/me",
    "/payroll",
    "/payroll/runs/abc",
    "/payroll/runs/abc/paysheet",
    "/people/employees/abc/documents",
    "/reports/payroll/readiness",
    "/administration/audit",
    "/login",
  ])("does not treat %s as a print document route", (pathname) => {
    expect(isPrintDocumentRoute(pathname)).toBe(false);
  });
});
