import { describe, expect, it } from "vitest";

import {
  buildEmployeeUserEmail,
  normalizeLoginEmail,
} from "@/src/modules/auth/lib/employee-login-email";

describe("normalizeLoginEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeLoginEmail("  Pat.Smith@Example.COM ")).toBe(
      "pat.smith@example.com",
    );
  });
});

describe("buildEmployeeUserEmail", () => {
  it("uses personal email as login identity", () => {
    expect(
      buildEmployeeUserEmail({
        personalEmail: "  Jane.Doe@Example.com ",
      }),
    ).toBe("jane.doe@example.com");
  });

  it("requires personal email — does not invent a local address", () => {
    expect(() =>
      buildEmployeeUserEmail({
        personalEmail: null,
      }),
    ).toThrow(/personal email is required/i);

    expect(() =>
      buildEmployeeUserEmail({
        personalEmail: "   ",
      }),
    ).toThrow(/personal email is required/i);
  });
});
