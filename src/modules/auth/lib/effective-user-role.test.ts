import { describe, expect, it } from "vitest";

import { isUserRoleCurrentlyEffective } from "@/src/modules/auth/lib/effective-user-role";

describe("isUserRoleCurrentlyEffective", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");

  it("requires ACTIVE status", () => {
    expect(
      isUserRoleCurrentlyEffective(
        {
          status: "REVOKED",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveUntil: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("rejects future-dated ACTIVE grants", () => {
    expect(
      isUserRoleCurrentlyEffective(
        {
          status: "ACTIVE",
          effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
          effectiveUntil: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("rejects expired ACTIVE grants", () => {
    expect(
      isUserRoleCurrentlyEffective(
        {
          status: "ACTIVE",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveUntil: new Date("2026-07-01T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("accepts open-ended and still-open windows", () => {
    expect(
      isUserRoleCurrentlyEffective(
        {
          status: "ACTIVE",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveUntil: null,
        },
        now,
      ),
    ).toBe(true);

    expect(
      isUserRoleCurrentlyEffective(
        {
          status: "ACTIVE",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveUntil: new Date("2026-12-31T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(true);
  });

  it("accepts effectiveUntil equal to now", () => {
    expect(
      isUserRoleCurrentlyEffective(
        {
          status: "ACTIVE",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveUntil: now,
        },
        now,
      ),
    ).toBe(true);
  });
});
