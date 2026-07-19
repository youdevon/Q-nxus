import { describe, expect, it } from "vitest";

import {
  permissionGroupKey,
  permissionGroupLabel,
} from "@/src/modules/admin/lib/permission-groups";

describe("permissionGroupKey", () => {
  it("places self-service codes in Self-service", () => {
    expect(
      permissionGroupKey({
        code: "people.profile.view_own",
        moduleKey: "people",
      }),
    ).toBe("self-service");
    expect(
      permissionGroupKey({
        code: "leave.request",
        moduleKey: "leave",
      }),
    ).toBe("self-service");
  });

  it("maps modules to HR / Leave / Payroll / Admin", () => {
    expect(
      permissionGroupKey({
        code: "people.manage",
        moduleKey: "people",
      }),
    ).toBe("hr");
    expect(
      permissionGroupKey({
        code: "leave.manage",
        moduleKey: "leave",
      }),
    ).toBe("leave");
    expect(
      permissionGroupKey({
        code: "payroll.view",
        moduleKey: "payroll",
      }),
    ).toBe("payroll");
    expect(
      permissionGroupKey({
        code: "identity.role.manage",
        moduleKey: "identity",
      }),
    ).toBe("admin");
  });

  it("labels groups for the picker", () => {
    expect(permissionGroupLabel("self-service")).toBe("Self-service");
    expect(permissionGroupLabel("hr")).toBe("HR");
  });
});
