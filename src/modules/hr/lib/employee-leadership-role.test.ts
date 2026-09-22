import { describe, expect, it } from "vitest";

import {
  resolveEmployeeLeadershipRole,
  employeeHeaderBadgeLabel,
  employeeLeadershipRoleLabel,
} from "@/src/modules/hr/lib/employee-leadership-role";

describe("resolveEmployeeLeadershipRole", () => {
  it("detects general manager from title", () => {
    expect(
      resolveEmployeeLeadershipRole({
        positionTitle: "General Manager",
        reportsToPositionId: null,
        directReportCount: 0,
      }),
    ).toBe("GENERAL_MANAGER");
  });

  it("detects manager and supervisor from title", () => {
    expect(
      resolveEmployeeLeadershipRole({
        positionTitle: "Operations Manager",
        reportsToPositionId: "gm",
        directReportCount: 0,
      }),
    ).toBe("MANAGER");

    expect(
      resolveEmployeeLeadershipRole({
        positionTitle: "Shift Supervisor",
        reportsToPositionId: "mgr",
        directReportCount: 0,
      }),
    ).toBe("SUPERVISOR");
  });

  it("uses hierarchy when title is neutral", () => {
    expect(
      resolveEmployeeLeadershipRole({
        positionTitle: "Head of Agency",
        reportsToPositionId: null,
        directReportCount: 4,
      }),
    ).toBe("GENERAL_MANAGER");

    expect(
      resolveEmployeeLeadershipRole({
        positionTitle: "Coordinator",
        reportsToPositionId: "gm",
        directReportCount: 5,
      }),
    ).toBe("MANAGER");

    expect(
      resolveEmployeeLeadershipRole({
        positionTitle: "Coordinator",
        reportsToPositionId: "mgr",
        directReportCount: 2,
      }),
    ).toBe("SUPERVISOR");

    expect(
      resolveEmployeeLeadershipRole({
        positionTitle: "Clerk",
        reportsToPositionId: "sup",
        directReportCount: 0,
      }),
    ).toBe("WORKER");
  });

  it("labels roles for display", () => {
    expect(employeeLeadershipRoleLabel("WORKER")).toBe("Regular worker");
  });

  it("prefers job title on the header badge", () => {
    expect(
      employeeHeaderBadgeLabel("WORKER", "Accounts Clerk"),
    ).toBe("Accounts Clerk");
    expect(employeeHeaderBadgeLabel("WORKER", null)).toBe("No position");
    expect(
      employeeHeaderBadgeLabel("MANAGER", "Operations Manager"),
    ).toBe("Operations Manager");
  });
});
