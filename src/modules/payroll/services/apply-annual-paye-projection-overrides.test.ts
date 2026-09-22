import { describe, expect, it } from "vitest";

import {
  filterOpenPeriodEnds,
  listRemainingMonthlyPeriodEnds,
} from "@/src/modules/payroll/lib/remaining-payroll-periods";

describe("filterOpenPeriodEnds", () => {
  it("keeps open periods and skips posted period ends", () => {
    const periodEnds = [
      new Date("2026-08-31T00:00:00.000Z"),
      new Date("2026-09-30T00:00:00.000Z"),
      new Date("2026-10-31T00:00:00.000Z"),
      new Date("2026-11-30T00:00:00.000Z"),
    ];
    const posted = new Set(["2026-08-31", "2026-09-30"]);

    const { open, skippedPosted } = filterOpenPeriodEnds(periodEnds, posted);

    expect(open.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-10-31",
      "2026-11-30",
    ]);
    expect(skippedPosted.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-08-31",
      "2026-09-30",
    ]);
  });

  it("returns all periods open when nothing is posted", () => {
    const periodEnds = [
      new Date("2026-11-30T00:00:00.000Z"),
      new Date("2026-12-31T00:00:00.000Z"),
    ];

    const { open, skippedPosted } = filterOpenPeriodEnds(
      periodEnds,
      new Set(),
    );

    expect(open).toHaveLength(2);
    expect(skippedPosted).toHaveLength(0);
  });
});

describe("listRemainingMonthlyPeriodEnds with posted filter", () => {
  it("supports approve→override cascade period selection", () => {
    const ends = listRemainingMonthlyPeriodEnds({
      taxYear: 2026,
      asOfDate: new Date("2026-06-30T00:00:00.000Z"),
      projectionEndDate: new Date("2026-12-31T00:00:00.000Z"),
    });
    const { open } = filterOpenPeriodEnds(
      ends,
      new Set(["2026-07-31"]),
    );

    expect(open.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });
});
