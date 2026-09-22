import { describe, expect, it } from "vitest";

import {
  redactIdentityFieldsInRecord,
  redactIdentityForAudit,
} from "@/src/modules/hr/lib/redact-identity";

describe("redactIdentityForAudit", () => {
  it("masks to last four", () => {
    expect(redactIdentityForAudit("123456789")).toBe("••••6789");
  });

  it("returns null for empty", () => {
    expect(redactIdentityForAudit("  ")).toBeNull();
    expect(redactIdentityForAudit(null)).toBeNull();
  });
});

describe("redactIdentityFieldsInRecord", () => {
  it("masks known identity keys", () => {
    expect(
      redactIdentityFieldsInRecord({
        firstName: "Ada",
        nisNumber: "11112222",
        birNumber: "99998888",
        idNumber: "AB1234",
      }),
    ).toEqual({
      firstName: "Ada",
      nisNumber: "••••2222",
      birNumber: "••••8888",
      idNumber: "••••1234",
    });
  });
});
