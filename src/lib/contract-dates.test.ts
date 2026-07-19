import { describe, expect, it } from "vitest";

import {
  addCalendarMonths,
  calculateContractEndDate,
  inferContractPeriod,
} from "@/src/lib/contract-dates";

describe("contract length end-date math", () => {
  it("calculates 6-month ends as day before start + 6 months", () => {
    expect(calculateContractEndDate("2026-01-01", "6M")).toBe("2026-06-30");
    expect(calculateContractEndDate("2026-01-15", "6M")).toBe("2026-07-14");
    expect(calculateContractEndDate("2026-08-31", "6M")).toBe("2027-02-27");
  });

  it("calculates 1-year ends as day before the next anniversary", () => {
    expect(calculateContractEndDate("2026-01-01", "1Y")).toBe("2026-12-31");
    expect(calculateContractEndDate("2026-01-15", "1Y")).toBe("2027-01-14");
    expect(calculateContractEndDate("2026-03-01", "1Y")).toBe("2027-02-28");
  });

  it("calculates 3-year ends as day before the third anniversary", () => {
    expect(calculateContractEndDate("2026-01-01", "3Y")).toBe("2028-12-31");
    expect(calculateContractEndDate("2024-02-29", "3Y")).toBe("2027-02-27");
  });

  it("clamps month addition on short target months", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("infers matching presets and falls back to custom", () => {
    expect(inferContractPeriod("2026-01-01", "2026-06-30")).toBe("6M");
    expect(inferContractPeriod("2026-01-01", "2026-12-31")).toBe("1Y");
    expect(inferContractPeriod("2026-01-01", "2028-12-31")).toBe("3Y");
    expect(inferContractPeriod("2026-01-01", "2026-09-15")).toBe("custom");
  });

  it("rejects invalid ISO dates", () => {
    expect(calculateContractEndDate("2026-02-30", "1Y")).toBeNull();
    expect(calculateContractEndDate("not-a-date", "6M")).toBeNull();
  });
});
