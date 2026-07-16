import { describe, expect, it } from "vitest";

import {
  aggregateIncludedPayRunTotals,
  filterIncludedPayRunRows,
  isPayslipIncludedInRun,
  normalizeExclusionReason,
} from "./pay-run-membership";

describe("pay-run membership", () => {
  it("treats DRAFT and POSTED as included, EXCLUDED as not", () => {
    expect(isPayslipIncludedInRun("DRAFT")).toBe(true);
    expect(isPayslipIncludedInRun("POSTED")).toBe(true);
    expect(isPayslipIncludedInRun("EXCLUDED")).toBe(false);
  });

  it("aggregates totals from included employees only", () => {
    const totals = aggregateIncludedPayRunTotals([
      {
        status: "DRAFT",
        grossPay: 1000,
        totalDeductions: 100,
        netPay: 900,
      },
      {
        status: "EXCLUDED",
        grossPay: 2000,
        totalDeductions: 200,
        netPay: 1800,
      },
      {
        status: "DRAFT",
        grossPay: 500.555,
        totalDeductions: 50.111,
        netPay: 450.444,
      },
    ]);

    expect(totals.employeeCount).toBe(2);
    expect(totals.excludedCount).toBe(1);
    expect(totals.totalGross).toBe(1500.56);
    expect(totals.totalDeductions).toBe(150.11);
    expect(totals.totalNet).toBe(1350.44);
  });

  it("filters included rows for readiness / post", () => {
    const rows = filterIncludedPayRunRows([
      { id: "a", status: "DRAFT" as const },
      { id: "b", status: "EXCLUDED" as const },
      { id: "c", status: "POSTED" as const },
    ]);

    expect(rows.map((row) => row.id)).toEqual(["a", "c"]);
  });

  it("requires a non-empty exclusion reason and trims whitespace", () => {
    expect(normalizeExclusionReason("")).toBeNull();
    expect(normalizeExclusionReason("   ")).toBeNull();
    expect(normalizeExclusionReason("  On leave  ")).toBe("On leave");
    expect(normalizeExclusionReason("a".repeat(600))?.length).toBe(500);
  });
});
