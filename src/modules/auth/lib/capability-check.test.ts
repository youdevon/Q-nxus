import { describe, expect, it } from "vitest";

import {
  canPerformAdminMutation,
  hasAnyCapability,
  hasCapability,
} from "@/src/modules/auth/lib/capability-check";

describe("capability checks", () => {
  it("grants exact permission matches", () => {
    expect(
      hasCapability(["leave.request", "contracts.view"], "leave.request"),
    ).toBe(true);
    expect(hasCapability(["leave.request"], "leave.manage")).toBe(false);
  });

  it("supports canAny semantics", () => {
    expect(
      hasAnyCapability(
        ["contracts.view"],
        ["contracts.view", "contracts.manage"],
      ),
    ).toBe(true);
    expect(
      hasAnyCapability(
        ["leave.request"],
        ["contracts.view", "contracts.manage"],
      ),
    ).toBe(false);
  });

  it("system admin bypasses capability checks", () => {
    expect(
      hasCapability([], "administration.manage", {
        isSystemAdmin: true,
      }),
    ).toBe(true);
  });

  it("blocks admin mutations when only administration.view is granted", () => {
    expect(
      canPerformAdminMutation(
        ["administration.view"],
        ["identity.user.update"],
      ),
    ).toBe(false);

    expect(
      canPerformAdminMutation(
        ["administration.view", "identity.user.update"],
        ["identity.user.update"],
      ),
    ).toBe(true);

    expect(
      canPerformAdminMutation(
        ["administration.manage"],
        ["identity.role.manage"],
      ),
    ).toBe(true);
  });
});
