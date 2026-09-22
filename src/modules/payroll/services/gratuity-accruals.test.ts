import { describe, expect, it } from "vitest";

import { accruedGratuityToDate } from "@/src/modules/payroll/services/gratuity-settlement";

describe("monthly accrual delta math", () => {
  it("recognizes half obligation mid-year then the remainder later", () => {
    const obligation = 38_400;
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-12-31T00:00:00.000Z");

    const mid = accruedGratuityToDate({
      grossObligation: obligation,
      contractStart: start,
      contractEnd: end,
      asOf: new Date("2026-06-30T00:00:00.000Z"),
    });
    const full = accruedGratuityToDate({
      grossObligation: obligation,
      contractStart: start,
      contractEnd: end,
      asOf: new Date("2026-12-31T00:00:00.000Z"),
    });

    expect(mid).toBe(19_200);
    expect(full).toBe(38_400);
    expect(full - mid).toBe(19_200);
  });
});
