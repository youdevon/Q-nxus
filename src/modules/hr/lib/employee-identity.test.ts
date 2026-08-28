import { describe, expect, it } from "vitest";

import { resolveStatutoryNumber } from "@/src/modules/hr/lib/employee-identity";

describe("resolveStatutoryNumber", () => {
  it("prefers the existing employee value when present", () => {
    expect(resolveStatutoryNumber("EMP-NIS", "FORM-NIS")).toBe("EMP-NIS");
  });

  it("falls back to the incoming form value when employee is empty", () => {
    expect(resolveStatutoryNumber(null, "FORM-NIS")).toBe("FORM-NIS");
    expect(resolveStatutoryNumber("  ", "FORM-NIS")).toBe("FORM-NIS");
  });

  it("returns null when neither side has a value", () => {
    expect(resolveStatutoryNumber(null, null)).toBeNull();
    expect(resolveStatutoryNumber("", "  ")).toBeNull();
  });
});
