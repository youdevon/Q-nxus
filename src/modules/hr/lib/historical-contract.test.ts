import { describe, expect, it } from "vitest";

import { isHistoricalEndedContract } from "@/src/modules/hr/lib/historical-contract";

describe("isHistoricalEndedContract", () => {
  it("returns false when there is no end date", () => {
    expect(isHistoricalEndedContract(null)).toBe(false);
  });

  it("returns true when end date is before today UTC", () => {
    expect(isHistoricalEndedContract(new Date("2020-01-01T12:00:00.000Z"))).toBe(
      true,
    );
  });

  it("returns false when end date is today or later", () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(12, 0, 0, 0);

    expect(isHistoricalEndedContract(tomorrow)).toBe(false);
  });
});
