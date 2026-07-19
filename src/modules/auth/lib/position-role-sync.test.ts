import { describe, expect, it } from "vitest";

import {
  planPositionRoleSync,
  positionRoleIdsToRevoke,
} from "@/src/modules/auth/lib/position-role-sync";

describe("planPositionRoleSync", () => {
  it("never plans SYSTEM_ADMINISTRATOR from a position", () => {
    expect(
      planPositionRoleSync({
        systemRoleCode: "SYSTEM_ADMINISTRATOR",
        hasDirectReports: false,
      }),
    ).toEqual({ desiredCodes: [] });
  });

  it("grants leave approver from direct reports or explicit code", () => {
    expect(
      planPositionRoleSync({
        systemRoleCode: null,
        hasDirectReports: true,
      }),
    ).toEqual({ desiredCodes: ["LEAVE_APPROVER"] });

    expect(
      planPositionRoleSync({
        systemRoleCode: "LEAVE_APPROVER",
        hasDirectReports: false,
      }),
    ).toEqual({ desiredCodes: ["LEAVE_APPROVER"] });
  });

  it("grants allowlisted elevated roles", () => {
    expect(
      planPositionRoleSync({
        systemRoleCode: "HR_ADMINISTRATOR",
        hasDirectReports: false,
      }),
    ).toEqual({ desiredCodes: ["HR_ADMINISTRATOR"] });
  });
});

describe("positionRoleIdsToRevoke", () => {
  it("revokes by id set, not reason strings", () => {
    expect(
      positionRoleIdsToRevoke({
        activePositionRoleIds: ["a", "b", "c"],
        keepRoleIds: ["b"],
      }),
    ).toEqual(["a", "c"]);
  });
});
