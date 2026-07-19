import { describe, expect, it } from "vitest";

import { canDeleteDepartment } from "@/src/modules/hr/lib/can-delete-department";

describe("canDeleteDepartment", () => {
  it("allows delete when the department has no dependents", () => {
    expect(canDeleteDepartment({})).toEqual({ allowed: true });
  });

  it("allows delete when positions exist (removed during delete)", () => {
    expect(
      canDeleteDepartment({
        positionCount: 2,
      }),
    ).toEqual({ allowed: true });
  });

  it("allows delete when employees are assigned (unassigned during delete)", () => {
    expect(
      canDeleteDepartment({
        employeeCount: 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("allows delete when historical assignments exist (cleared during delete)", () => {
    expect(
      canDeleteDepartment({
        assignmentCount: 3,
      }),
    ).toEqual({ allowed: true });
  });
});
