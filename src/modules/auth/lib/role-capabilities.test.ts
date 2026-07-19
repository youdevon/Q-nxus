import { describe, expect, it } from "vitest";

import {
  aggregatePermissionsFromRoles,
  collectRoleCodes,
  isEmployeeOnlyAccess,
  isHrAdministrator,
  isSystemAdministrator,
} from "@/src/modules/auth/lib/role-capabilities";

describe("aggregatePermissionsFromRoles", () => {
  it("unions permissions across built-in and custom roles", () => {
    const permissions = aggregatePermissionsFromRoles([
      {
        roleCode: "EMPLOYEE",
        permissionCodes: [
          "notification.view_own",
          "people.profile.view_own",
          "leave.request",
        ],
      },
      {
        roleCode: "CUSTOM_PAYROLL_VIEWER",
        permissionCodes: ["payroll.view", "people.directory.view"],
      },
      {
        roleCode: "EMPLOYEE",
        permissionCodes: ["leave.request"],
      },
    ]);

    expect(permissions).toEqual([
      "leave.request",
      "notification.view_own",
      "payroll.view",
      "people.directory.view",
      "people.profile.view_own",
    ]);
  });

  it("returns an empty list when no grants exist", () => {
    expect(aggregatePermissionsFromRoles([])).toEqual([]);
  });
});

describe("collectRoleCodes", () => {
  it("dedupes role codes", () => {
    expect(
      collectRoleCodes([
        { roleCode: "EMPLOYEE", permissionCodes: [] },
        { roleCode: "HR_CLERK", permissionCodes: [] },
        { roleCode: "EMPLOYEE", permissionCodes: [] },
      ]),
    ).toEqual(["EMPLOYEE", "HR_CLERK"]);
  });
});

describe("access classification", () => {
  it("detects system and HR administrator role codes", () => {
    expect(isSystemAdministrator(["SYSTEM_ADMINISTRATOR"])).toBe(true);
    expect(isHrAdministrator(["HR_ADMINISTRATOR"])).toBe(true);
    expect(isHrAdministrator(["HR_PAYROLL_ADMINISTRATOR"])).toBe(true);
    expect(isHrAdministrator(["EMPLOYEE"])).toBe(false);
  });

  it("treats pure self-service grants as employee-only", () => {
    expect(
      isEmployeeOnlyAccess(
        ["EMPLOYEE"],
        ["notification.view_own", "people.profile.view_own", "leave.request"],
      ),
    ).toBe(true);
  });

  it("does not treat custom elevated permissions as employee-only", () => {
    expect(
      isEmployeeOnlyAccess(
        ["EMPLOYEE", "CUSTOM_HR_HELPER"],
        [
          "notification.view_own",
          "people.profile.view_own",
          "leave.request",
          "people.manage",
        ],
      ),
    ).toBe(false);
  });

  it("does not treat built-in staff roles as employee-only", () => {
    expect(
      isEmployeeOnlyAccess(["LEAVE_APPROVER"], ["leave.approve", "leave.request"]),
    ).toBe(false);
  });
});
