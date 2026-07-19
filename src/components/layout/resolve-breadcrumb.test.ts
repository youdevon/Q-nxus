import { describe, expect, it } from "vitest";

import {
  resolveBreadcrumb,
  simplifyAppBreadcrumbs,
} from "@/src/components/layout/resolve-breadcrumb";

const employeeId = "cm12345678901234567890";
const recordId = "cm09876543210987654321";

function labels(pathname: string): string[] {
  return simplifyAppBreadcrumbs(resolveBreadcrumb(pathname)).map(
    (crumb) => crumb.label,
  );
}

describe("administration route breadcrumbs", () => {
  it("keeps Administration as the nav root across nested admin routes", () => {
    // Organization is the sidebar landing route, so it is the nav root itself.
    expect(labels("/administration/organization")).toEqual(["Administration"]);
    expect(labels("/administration/access")).toEqual([
      "Administration",
      "Users and roles",
    ]);
  });
});

describe("people leave route breadcrumbs", () => {
  it("keeps Employees as the People root for leave routes", () => {
    expect(labels("/people/leave")).toEqual(["Employees", "Leave"]);
    expect(labels("/people/leave/new")).toEqual([
      "Employees",
      "Leave",
      "Request leave",
    ]);
    expect(labels(`/people/leave/${recordId}`)).toEqual([
      "Employees",
      "Leave",
      "Request",
    ]);
    expect(labels("/people/leave/holidays")).toEqual([
      "Employees",
      "Leave",
      "Holidays",
    ]);
    expect(labels("/people/leave/balances")).toEqual([
      "Employees",
      "Leave",
      "Balances",
    ]);
    expect(labels("/people/leave/workflow")).toEqual([
      "Employees",
      "Leave",
      "Workflow",
    ]);
    expect(labels("/people/leave/types")).toEqual([
      "Employees",
      "Leave",
      "Types",
    ]);
  });
});

describe("payroll employee route breadcrumbs", () => {
  it("keeps Payroll as the nav root for employee setup routes", () => {
    expect(labels(`/payroll/employees/${employeeId}`)).toEqual([
      "Payroll",
      "Employee",
    ]);
    expect(labels(`/payroll/employees/${employeeId}/payslip`)).toEqual([
      "Payroll",
      "Employee",
      "Payslip",
    ]);
    expect(labels(`/payroll/employees/${employeeId}/payslip/print`)).toEqual([
      "Employee",
      "Payslip",
      "Print",
    ]);
  });
});

describe("employee route breadcrumbs", () => {
  it("does not repeat the employee directory root", () => {
    expect(labels(`/people/employees/${employeeId}`)).toEqual([
      "Employees",
      "Employee",
    ]);
    expect(labels("/people/employees/new")).toEqual([
      "Employees",
      "New employee",
    ]);
  });

  it("keeps employee collection context on nested routes", () => {
    expect(
      labels(`/people/employees/${employeeId}/contracts/${recordId}`),
    ).toEqual(["Employee", "Contracts", "Contract"]);
    expect(
      labels(`/people/employees/${employeeId}/qualifications/new`),
    ).toEqual(["Employee", "Qualifications", "New qualification"]);
  });

  it("labels self-service employee-file records", () => {
    expect(labels(`/me/documents/${recordId}`)).toEqual([
      "My Profile",
      "Documents",
      "Document",
    ]);
  });
});
