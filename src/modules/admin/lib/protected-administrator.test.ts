import { describe, expect, it } from "vitest";

import {
  DEFAULT_ADMINISTRATOR_EMAIL,
  DEFAULT_ADMINISTRATOR_USER_ID,
  isDefaultAdministratorUser,
  mergeProtectedUserIds,
} from "@/src/modules/admin/lib/protected-administrator";

describe("isDefaultAdministratorUser", () => {
  it("matches the seeded administrator id", () => {
    expect(
      isDefaultAdministratorUser({
        id: DEFAULT_ADMINISTRATOR_USER_ID,
        email: "other@example.com",
      }),
    ).toBe(true);
  });

  it("matches the seeded administrator email case-insensitively", () => {
    expect(
      isDefaultAdministratorUser({
        id: "other-user",
        email: "  Admin@Q-NXUS.Local ",
      }),
    ).toBe(true);
  });

  it("does not match unrelated users", () => {
    expect(
      isDefaultAdministratorUser({
        id: "user-hr-clerk",
        email: "hr@example.com",
      }),
    ).toBe(false);
  });
});

describe("mergeProtectedUserIds", () => {
  it("deduplicates protected user ids", () => {
    expect(
      mergeProtectedUserIds(
        ["user-a", "user-b"],
        ["user-b", "user-c"],
        [DEFAULT_ADMINISTRATOR_USER_ID],
      ),
    ).toEqual(["user-a", "user-b", "user-c", DEFAULT_ADMINISTRATOR_USER_ID]);
  });
});

describe("DEFAULT_ADMINISTRATOR_EMAIL", () => {
  it("matches the seed administrator login", () => {
    expect(DEFAULT_ADMINISTRATOR_EMAIL).toBe("admin@q-nxus.local");
  });
});
