import { describe, expect, it } from "vitest";

import {
  daysUntilExpiry,
  getExpiryStatus,
  isExpiryDashboardWindow,
} from "@/src/modules/hr/lib/correspondence-visibility";

describe("expiry dashboard ranges", () => {
  const asOf = new Date("2026-07-17T12:00:00.000Z");

  it("classifies expired, within window, and outside window", () => {
    expect(
      getExpiryStatus(new Date("2026-07-10T00:00:00.000Z"), asOf, 30),
    ).toBe("EXPIRED");
    expect(
      getExpiryStatus(new Date("2026-08-01T00:00:00.000Z"), asOf, 30),
    ).toBe("EXPIRING");
    expect(
      getExpiryStatus(new Date("2026-10-01T00:00:00.000Z"), asOf, 30),
    ).toBe("OK");
    expect(
      getExpiryStatus(new Date("2026-10-01T00:00:00.000Z"), asOf, 90),
    ).toBe("EXPIRING");
  });

  it("computes signed day deltas", () => {
    expect(daysUntilExpiry(new Date("2026-07-27T00:00:00.000Z"), asOf)).toBe(
      10,
    );
    expect(daysUntilExpiry(new Date("2026-07-07T00:00:00.000Z"), asOf)).toBe(
      -10,
    );
  });

  it("accepts 30/60/90 windows only", () => {
    expect(isExpiryDashboardWindow(30)).toBe(true);
    expect(isExpiryDashboardWindow(60)).toBe(true);
    expect(isExpiryDashboardWindow(90)).toBe(true);
    expect(isExpiryDashboardWindow(45)).toBe(false);
  });
});
