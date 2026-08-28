import { describe, expect, it } from "vitest";

import { resolvePriorEmploymentTaxMethodSync } from "./sync-tax-profile-previous-employment";

describe("resolvePriorEmploymentTaxMethodSync", () => {
  it("restores standard non-cumulative when the last prior record is gone", () => {
    expect(
      resolvePriorEmploymentTaxMethodSync({
        hasActivePriorRecords: false,
        currentMethod: "PREVIOUS_INCOME_INCLUDED",
      }),
    ).toEqual({
      taxCalculationMethod: "STANDARD_NON_CUMULATIVE",
      cumulativeCalculationEnabled: false,
    });
  });

  it("upgrades standard non-cumulative to previous-income when priors exist", () => {
    expect(
      resolvePriorEmploymentTaxMethodSync({
        hasActivePriorRecords: true,
        currentMethod: "STANDARD_NON_CUMULATIVE",
      }),
    ).toEqual({
      taxCalculationMethod: "PREVIOUS_INCOME_INCLUDED",
      cumulativeCalculationEnabled: true,
    });
  });

  it("does not override manual or explicit cumulative methods while priors remain", () => {
    expect(
      resolvePriorEmploymentTaxMethodSync({
        hasActivePriorRecords: true,
        currentMethod: "STANDARD_CUMULATIVE",
      }),
    ).toBeNull();

    expect(
      resolvePriorEmploymentTaxMethodSync({
        hasActivePriorRecords: true,
        currentMethod: "MANUAL_INSTRUCTION",
      }),
    ).toBeNull();
  });
});
