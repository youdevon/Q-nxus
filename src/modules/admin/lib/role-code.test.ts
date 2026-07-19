import { describe, expect, it } from "vitest";

import {
  isBuiltInRoleCode,
  isValidRoleCode,
  resolveRoleCode,
  slugifyRoleCode,
} from "@/src/modules/admin/lib/role-code";

describe("slugifyRoleCode", () => {
  it("uppercases and replaces spaces with underscores", () => {
    expect(slugifyRoleCode("HR Leave Clerk")).toBe("HR_LEAVE_CLERK");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugifyRoleCode("  payroll / setup  ")).toBe("PAYROLL_SETUP");
    expect(slugifyRoleCode("role--name...")).toBe("ROLE_NAME");
  });

  it("truncates to 50 characters", () => {
    const long = "A".repeat(60);
    expect(slugifyRoleCode(long)).toHaveLength(50);
  });
});

describe("resolveRoleCode", () => {
  it("prefers an explicit valid code", () => {
    expect(
      resolveRoleCode({
        code: "custom.role",
        name: "Ignored Name",
      }),
    ).toBe("CUSTOM.ROLE");
  });

  it("rejects an invalid explicit code", () => {
    expect(
      resolveRoleCode({
        code: "bad code!",
        name: "Valid Name",
      }),
    ).toBeNull();
  });

  it("slugs from name when code is omitted", () => {
    expect(
      resolveRoleCode({
        code: "",
        name: "Team Documents Viewer",
      }),
    ).toBe("TEAM_DOCUMENTS_VIEWER");
  });

  it("returns null when name cannot produce a valid code", () => {
    expect(
      resolveRoleCode({
        code: "",
        name: "!",
      }),
    ).toBeNull();
  });
});

describe("isValidRoleCode / isBuiltInRoleCode", () => {
  it("accepts dotted and hyphenated codes", () => {
    expect(isValidRoleCode("HR_CLERK")).toBe(true);
    expect(isValidRoleCode("CUSTOM.ROLE-1")).toBe(true);
    expect(isValidRoleCode("A")).toBe(false);
  });

  it("recognizes seeded built-in codes", () => {
    expect(isBuiltInRoleCode("SYSTEM_ADMINISTRATOR")).toBe(true);
    expect(isBuiltInRoleCode("CUSTOM_ROLE")).toBe(false);
  });
});
