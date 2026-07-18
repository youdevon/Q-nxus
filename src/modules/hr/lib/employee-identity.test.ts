import { describe, expect, it } from "vitest";

import { resolveStatutoryNumber } from "@/src/modules/hr/lib/employee-identity";

describe("resolveStatutoryNumber", () => {
  it("prefers the employee value when present", () => {
    expect(resolveStatutoryNumber("EMP-NIS", "PROFILE-NIS")).toBe("EMP-NIS");
  });

  it("falls back to the payroll profile copy", () => {
    expect(resolveStatutoryNumber(null, "PROFILE-NIS")).toBe("PROFILE-NIS");
    expect(resolveStatutoryNumber("  ", "PROFILE-NIS")).toBe("PROFILE-NIS");
  });

  it("returns null when neither side has a value", () => {
    expect(resolveStatutoryNumber(null, null)).toBeNull();
    expect(resolveStatutoryNumber("", "  ")).toBeNull();
  });
});
