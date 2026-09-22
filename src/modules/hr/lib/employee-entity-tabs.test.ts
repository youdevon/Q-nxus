import { describe, expect, it } from "vitest";

import { employeeEntityTabs } from "@/src/modules/hr/lib/employee-entity-tabs";

describe("employeeEntityTabs", () => {
  it("includes core tabs for a full employee", () => {
    const tabs = employeeEntityTabs({
      employeeId: "e1",
      current: "profile",
      workforceCategory: "EMPLOYEE",
      isFullEmployee: true,
    });

    expect(tabs.map((tab) => tab.id)).toEqual([
      "profile",
      "contracts",
      "file",
      "job-description",
      "assignments",
      "appraisals",
      "assets",
      "payroll",
    ]);
    expect(tabs.find((tab) => tab.id === "profile")?.current).toBe(true);
  });

  it("hides employee-file tabs for non-employee payees", () => {
    const tabs = employeeEntityTabs({
      employeeId: "e1",
      current: "contracts",
      workforceCategory: "BOARD_MEMBER",
      isFullEmployee: false,
    });

    expect(tabs.map((tab) => tab.id)).toEqual([
      "profile",
      "contracts",
      "assets",
      "payroll",
    ]);
  });
});
