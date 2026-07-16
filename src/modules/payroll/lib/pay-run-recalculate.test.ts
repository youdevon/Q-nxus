import { describe, expect, it } from "vitest";

import { aggregateIncludedPayRunTotals } from "./pay-run-membership";

/**
 * Recalc preserves excluded membership while refreshing included totals.
 * Mirrors manage-pay-run.recalculateDraftPayRun aggregation after snapshot refresh.
 */
describe("draft pay-run recalculate membership", () => {
  it("rebuilds totals from refreshed included snapshots only", () => {
    const before = [
      {
        status: "DRAFT" as const,
        grossPay: 1000,
        totalDeductions: 100,
        netPay: 900,
      },
      {
        status: "EXCLUDED" as const,
        grossPay: 5000,
        totalDeductions: 500,
        netPay: 4500,
      },
    ];

    const afterRecalc = [
      {
        status: "DRAFT" as const,
        // refreshed from current contract
        grossPay: 1200,
        totalDeductions: 150,
        netPay: 1050,
      },
      {
        status: "EXCLUDED" as const,
        // exclusion amounts unchanged
        grossPay: 5000,
        totalDeductions: 500,
        netPay: 4500,
      },
    ];

    const beforeTotals = aggregateIncludedPayRunTotals(before);
    const afterTotals = aggregateIncludedPayRunTotals(afterRecalc);

    expect(beforeTotals.employeeCount).toBe(1);
    expect(beforeTotals.excludedCount).toBe(1);
    expect(beforeTotals.totalNet).toBe(900);

    expect(afterTotals.employeeCount).toBe(1);
    expect(afterTotals.excludedCount).toBe(1);
    expect(afterTotals.totalGross).toBe(1200);
    expect(afterTotals.totalDeductions).toBe(150);
    expect(afterTotals.totalNet).toBe(1050);
  });

  it("keeps zero included employees when everyone is excluded", () => {
    const totals = aggregateIncludedPayRunTotals([
      {
        status: "EXCLUDED",
        grossPay: 1000,
        totalDeductions: 100,
        netPay: 900,
      },
    ]);

    expect(totals.employeeCount).toBe(0);
    expect(totals.excludedCount).toBe(1);
    expect(totals.totalNet).toBe(0);
  });
});
