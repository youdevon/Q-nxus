import { describe, expect, it } from "vitest";

import { countWorkingDaysInclusive } from "@/src/modules/hr/lib/leave-day-math";
import { calculateLeaveDays } from "@/src/modules/hr/services/calculate-leave-days";

describe("leave working-day counting with holidays", () => {
  it("excludes weekends and organization holidays", () => {
    expect(
      countWorkingDaysInclusive("2026-07-13", "2026-07-17", ["2026-07-15"]),
    ).toBe(4);

    expect(
      calculateLeaveDays({
        startDate: new Date("2026-07-13T00:00:00.000Z"),
        endDate: new Date("2026-07-17T00:00:00.000Z"),
        holidayDates: ["2026-07-15"],
      }).requestedQuantity.toString(),
    ).toBe("4");
  });
});
