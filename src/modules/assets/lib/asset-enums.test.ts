import { describe, expect, it } from "vitest";

import {
  labelAssetEnum,
  parseAssetStatus,
  warrantyFilterCutoff,
} from "./asset-enums";

describe("asset-enums", () => {
  it("labels enum values for display", () => {
    expect(labelAssetEnum("IN_REPAIR")).toBe("In Repair");
    expect(labelAssetEnum("COMPUTER_EQUIPMENT")).toBe("Equipment");
  });

  it("parses known statuses only", () => {
    expect(parseAssetStatus("AVAILABLE")).toBe("AVAILABLE");
    expect(parseAssetStatus("nope")).toBeNull();
  });

  it("builds a warranty cutoff N days ahead", () => {
    const from = new Date("2026-09-08T12:00:00Z");
    const cutoff = warrantyFilterCutoff(90, from);
    expect(cutoff.toISOString().slice(0, 10)).toBe("2026-12-07");
  });
});
