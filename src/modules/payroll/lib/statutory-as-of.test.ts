import { describe, expect, it } from "vitest";

import {
  statutoryScheduleCoversAsOf,
  taxYearFromAsOfKey,
  toStatutoryAsOfDate,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

describe("statutory-as-of", () => {
  it("normalizes Date and string as-of keys", () => {
    expect(toStatutoryAsOfKey("2026-03-15")).toBe("2026-03-15");
    expect(toStatutoryAsOfKey(new Date("2026-03-15T12:00:00.000Z"))).toBe(
      "2026-03-15",
    );
    expect(toStatutoryAsOfDate("2026-03-15").toISOString()).toBe(
      "2026-03-15T00:00:00.000Z",
    );
  });

  it("covers inclusive effective windows", () => {
    expect(
      statutoryScheduleCoversAsOf({
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        isActive: true,
        asOf: "2026-07-31",
      }),
    ).toBe(true);

    expect(
      statutoryScheduleCoversAsOf({
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-06-30",
        isActive: true,
        asOf: "2026-06-30",
      }),
    ).toBe(true);

    expect(
      statutoryScheduleCoversAsOf({
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-06-30",
        isActive: true,
        asOf: "2026-07-01",
      }),
    ).toBe(false);

    expect(
      statutoryScheduleCoversAsOf({
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        isActive: false,
        asOf: "2026-07-31",
      }),
    ).toBe(false);
  });

  it("derives calendar tax year from as-of", () => {
    expect(taxYearFromAsOfKey("2026-12-31")).toBe(2026);
  });
});
