import { describe, expect, it } from "vitest";

import {
  findEmployeesBlockedFromPayRun,
  formatBlockedEmployees,
} from "./pay-run-readiness-gate";

describe("pay-run readiness gate", () => {
  it("allows all ready employees", () => {
    const blocked = findEmployeesBlockedFromPayRun(
      [
        {
          employeeId: "a",
          employeeNumber: "EMP-1",
          employeeName: "Ada",
        },
      ],
      new Map([["a", { isReady: true, blockingIssues: [] }]]),
    );

    expect(blocked).toEqual([]);
  });

  it("blocks employees who are not ready with clear reasons", () => {
    const blocked = findEmployeesBlockedFromPayRun(
      [
        {
          employeeId: "a",
          employeeNumber: "EMP-1",
          employeeName: "Ada",
        },
        {
          employeeId: "b",
          employeeNumber: "EMP-2",
          employeeName: "Bob",
        },
      ],
      new Map([
        ["a", { isReady: true, blockingIssues: [] }],
        [
          "b",
          {
            isReady: false,
            blockingIssues: ["NIS number is required."],
          },
        ],
      ]),
    );

    expect(blocked).toEqual([
      "Bob (EMP-2): NIS number is required.",
    ]);
    expect(
      formatBlockedEmployees(
        blocked,
        "Cannot post — some employees are no longer payroll-ready:",
      ),
    ).toContain("NIS number is required.");
  });

  it("treats missing readiness rows as not ready", () => {
    const blocked = findEmployeesBlockedFromPayRun(
      [
        {
          employeeId: "missing",
          employeeNumber: "EMP-9",
          employeeName: "Missing",
        },
      ],
      new Map(),
    );

    expect(blocked[0]).toContain("Not payroll-ready.");
  });
});
