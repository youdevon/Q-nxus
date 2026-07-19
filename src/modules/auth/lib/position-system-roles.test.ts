import { describe, expect, it } from "vitest";

import {
  canSyncPositionRoleCode,
  isAllowedPositionSystemRoleCode,
  parsePositionSystemRoleCode,
  POSITION_SYSTEM_ROLE_OPTIONS,
} from "@/src/modules/auth/lib/position-system-roles";

describe("position system role allowlist", () => {
  it("excludes SYSTEM_ADMINISTRATOR from selectable options", () => {
    const values: string[] = POSITION_SYSTEM_ROLE_OPTIONS.map(
      (option) => option.value,
    );
    expect(values).not.toContain("SYSTEM_ADMINISTRATOR");
  });

  it("rejects SYSTEM_ADMINISTRATOR and unknown codes", () => {
    expect(isAllowedPositionSystemRoleCode("SYSTEM_ADMINISTRATOR")).toBe(
      false,
    );
    expect(isAllowedPositionSystemRoleCode("NOT_A_REAL_ROLE")).toBe(false);
    expect(parsePositionSystemRoleCode("SYSTEM_ADMINISTRATOR").ok).toBe(false);
  });

  it("allows empty clear and operational roles", () => {
    expect(isAllowedPositionSystemRoleCode(null)).toBe(true);
    expect(isAllowedPositionSystemRoleCode("")).toBe(true);
    expect(isAllowedPositionSystemRoleCode("HR_ADMINISTRATOR")).toBe(true);
    expect(parsePositionSystemRoleCode("PAYROLL_OFFICER")).toEqual({
      ok: true,
      code: "PAYROLL_OFFICER",
    });
    expect(parsePositionSystemRoleCode("  ")).toEqual({
      ok: true,
      code: null,
    });
  });

  it("blocks sync of system admin and employee base role", () => {
    expect(canSyncPositionRoleCode("SYSTEM_ADMINISTRATOR")).toBe(false);
    expect(canSyncPositionRoleCode("EMPLOYEE")).toBe(false);
    expect(canSyncPositionRoleCode("LEAVE_APPROVER")).toBe(true);
  });
});
