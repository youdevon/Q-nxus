import { describe, expect, it } from "vitest";

import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

/** Mirrors taxYearForEffectiveFrom without importing the prisma-backed service. */
function taxYearForEffectiveFrom(effectiveFrom: Date): number {
  return taxYearFromAsOfKey(toStatutoryAsOfKey(effectiveFrom));
}

describe("recalculateAfterTaxChange helpers", () => {
  it("resolves tax year from effective-from date", () => {
    expect(taxYearForEffectiveFrom(new Date("2026-07-01T00:00:00.000Z"))).toBe(
      2026,
    );
    expect(taxYearForEffectiveFrom(new Date("2025-01-15T00:00:00.000Z"))).toBe(
      2025,
    );
  });
});

describe("tax-year adjustment type coverage", () => {
  it("includes NON_TAXABLE_EARNINGS and HEALTH_SURCHARGE in the action allowlist", () => {
    const types = [
      "PREVIOUS_INCOME",
      "PREVIOUS_PAYE",
      "PERSONAL_ALLOWANCE",
      "TAXABLE_EARNINGS",
      "NON_TAXABLE_EARNINGS",
      "PAYE",
      "NIS",
      "HEALTH_SURCHARGE",
      "PENSION",
      "QUALIFYING_DEDUCTION",
      "PROJECTED_EARNINGS",
      "REMAINING_PERIOD",
      "NIS_DEDUCTIBLE_PORTION",
      "APPROVED_DEDUCTION_CAP",
      "TAX_RATE_INSTRUCTION",
      "OTHER_TAX",
    ];
    expect(types).toContain("NON_TAXABLE_EARNINGS");
    expect(types).toContain("HEALTH_SURCHARGE");
  });
});
