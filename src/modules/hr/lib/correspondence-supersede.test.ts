import { describe, expect, it } from "vitest";

import {
  canCreateSupersedingDraft,
  statusAfterSupersedingIssue,
} from "@/src/modules/hr/lib/correspondence-supersede";

describe("canCreateSupersedingDraft", () => {
  it("allows issued and acknowledged letters without an existing replacement", () => {
    expect(
      canCreateSupersedingDraft({
        status: "ISSUED",
        supersededById: null,
      }),
    ).toBe(true);
    expect(
      canCreateSupersedingDraft({
        status: "ACKNOWLEDGED",
      }),
    ).toBe(true);
  });

  it("blocks drafts and letters already superseded", () => {
    expect(
      canCreateSupersedingDraft({
        status: "DRAFT",
      }),
    ).toBe(false);
    expect(
      canCreateSupersedingDraft({
        status: "ISSUED",
        supersededById: "newer-id",
      }),
    ).toBe(false);
  });
});

describe("statusAfterSupersedingIssue", () => {
  it("marks the prior version as SUPERSEDED", () => {
    expect(statusAfterSupersedingIssue()).toBe("SUPERSEDED");
  });
});
