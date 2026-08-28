import { describe, expect, it } from "vitest";

import { filterEffectiveBankSetup } from "@/src/modules/payroll/lib/effective-dated-banking";

describe("filterEffectiveBankSetup", () => {
  const asOf = new Date("2026-07-15T12:00:00.000Z");

  it("keeps accounts and allocations effective on as-of", () => {
    const rows = filterEffectiveBankSetup(
      [
        {
          id: "a1",
          isActive: true,
          effectiveFrom: new Date("2026-01-01"),
          effectiveTo: null,
          allocations: [
            {
              id: "x1",
              isActive: true,
              effectiveFrom: new Date("2026-01-01"),
              effectiveTo: null,
            },
            {
              id: "x2",
              isActive: true,
              effectiveFrom: new Date("2026-08-01"),
              effectiveTo: null,
            },
          ],
        },
        {
          id: "a2",
          isActive: true,
          effectiveFrom: new Date("2025-01-01"),
          effectiveTo: new Date("2026-06-30"),
          allocations: [],
        },
      ],
      asOf,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("a1");
    expect(rows[0]?.allocations.map((row) => row.id)).toEqual(["x1"]);
  });
});
