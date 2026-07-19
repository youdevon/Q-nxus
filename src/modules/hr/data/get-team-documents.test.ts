import { describe, expect, it } from "vitest";

/**
 * Mirrors the holder-picking used by getDirectReportsForSupervisor.
 * Prefer an active linked user, else the first holder (assignments first).
 */
function pickSupervisorEmployeeId(
  holders: Array<{ employeeId: string; hasActiveUser: boolean }>,
): string | null {
  if (holders.length === 0) {
    return null;
  }

  const withActiveUser = holders.find((holder) => holder.hasActiveUser);
  return (withActiveUser ?? holders[0])?.employeeId ?? null;
}

describe("team documents supervisor batch pick", () => {
  it("prefers a holder with an active user", () => {
    expect(
      pickSupervisorEmployeeId([
        { employeeId: "vacant-linked", hasActiveUser: false },
        { employeeId: "active-boss", hasActiveUser: true },
      ]),
    ).toBe("active-boss");
  });

  it("falls back to the first holder when no active user exists", () => {
    expect(
      pickSupervisorEmployeeId([
        { employeeId: "first", hasActiveUser: false },
        { employeeId: "second", hasActiveUser: false },
      ]),
    ).toBe("first");
  });

  it("returns null for an empty holder list", () => {
    expect(pickSupervisorEmployeeId([])).toBeNull();
  });
});
