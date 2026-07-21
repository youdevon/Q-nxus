import { describe, expect, it } from "vitest";

import { resolveEmployeeStatutoryWriteFromPayroll } from "@/src/modules/hr/lib/employee-statutory-numbers";

function actorWith(...permissions: string[]) {
  return {
    can(permission: string) {
      return permissions.includes(permission);
    },
  };
}

describe("resolveEmployeeStatutoryWriteFromPayroll", () => {
  it("never writes Employee without people.manage", () => {
    const result = resolveEmployeeStatutoryWriteFromPayroll({
      actor: actorWith("payroll.setup"),
      employee: { nisNumber: null, birNumber: null },
      form: { nisNumber: "1234567", birNumber: "BIR-1" },
    });

    expect(result.employeeUpdate).toBeNull();
    expect(result.resolved).toEqual({
      nisNumber: null,
      birNumber: null,
    });
  });

  it("keeps existing Employee values and ignores form overrides without people.manage", () => {
    const result = resolveEmployeeStatutoryWriteFromPayroll({
      actor: actorWith("payroll.manage"),
      employee: { nisNumber: "EXISTING-NIS", birNumber: null },
      form: { nisNumber: "HACKED", birNumber: "NEW-BIR" },
    });

    expect(result.employeeUpdate).toBeNull();
    expect(result.resolved).toEqual({
      nisNumber: "EXISTING-NIS",
      birNumber: null,
    });
  });

  it("allows people.manage to fill empty Employee fields from form", () => {
    const result = resolveEmployeeStatutoryWriteFromPayroll({
      actor: actorWith("people.manage"),
      employee: { nisNumber: null, birNumber: "KEEP" },
      form: { nisNumber: "1234567", birNumber: "IGNORED" },
    });

    expect(result.employeeUpdate).toEqual({
      nisNumber: "1234567",
      birNumber: "KEEP",
    });
    expect(result.resolved).toEqual({
      nisNumber: "1234567",
      birNumber: "KEEP",
    });
  });

  it("skips Employee update when people.manage and values unchanged", () => {
    const result = resolveEmployeeStatutoryWriteFromPayroll({
      actor: actorWith("people.manage"),
      employee: { nisNumber: "NIS", birNumber: "BIR" },
      form: { nisNumber: "OTHER", birNumber: "OTHER" },
    });

    expect(result.employeeUpdate).toBeNull();
    expect(result.resolved).toEqual({ nisNumber: "NIS", birNumber: "BIR" });
  });
});
