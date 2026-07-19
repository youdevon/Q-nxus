import { describe, expect, it } from "vitest";

import { formatDisplayDate, formatDisplayDateTime } from "@/src/lib/format";

describe("formatDisplayDate", () => {
  it("formats ISO date-only as year month day", () => {
    expect(formatDisplayDate("2025-01-20")).toBe("2025 Jan 20");
    expect(formatDisplayDate("2026-07-05")).toBe("2026 Jul 5");
  });

  it("formats Date values in UTC", () => {
    expect(formatDisplayDate(new Date("2025-12-01T00:00:00.000Z"))).toBe(
      "2025 Dec 1",
    );
  });

  it("formats ISO datetimes from the date portion", () => {
    expect(formatDisplayDate("2025-01-20T15:30:00.000Z")).toBe("2025 Jan 20");
  });

  it("returns fallback for empty or invalid values", () => {
    expect(formatDisplayDate(null)).toBe("");
    expect(formatDisplayDate(undefined, { fallback: "—" })).toBe("—");
    expect(formatDisplayDate("not-a-date", { fallback: "—" })).toBe("—");
  });
});

describe("formatDisplayDateTime", () => {
  it("includes UTC clock time", () => {
    expect(formatDisplayDateTime("2025-01-20T15:05:00.000Z")).toBe(
      "2025 Jan 20, 15:05",
    );
  });
});
