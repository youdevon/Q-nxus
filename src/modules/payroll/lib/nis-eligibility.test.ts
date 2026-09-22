import { describe, expect, it } from "vitest";

import { resolveNisEligibility } from "./nis-eligibility";

describe("resolveNisEligibility", () => {
  const asOf = new Date("2026-08-31T00:00:00.000Z");

  it("applies Class Z at full retirement age even when exemptFromNis is set", () => {
    const result = resolveNisEligibility({
      dateOfBirth: "1958-05-30",
      asOf,
      exemptFromNis: true,
      receivingNisRetirementBenefit: false,
    });

    expect(result.category).toBe("CLASS_Z");
    expect(result.age).toBe(68);
  });

  it("honours exemptFromNis for employees below Class Z age", () => {
    const result = resolveNisEligibility({
      dateOfBirth: "1990-01-01",
      asOf,
      exemptFromNis: true,
      receivingNisRetirementBenefit: false,
    });

    expect(result.category).toBe("EXEMPT");
  });

  it("honours manual EXEMPT override for Class Z age", () => {
    const result = resolveNisEligibility({
      dateOfBirth: "1958-05-30",
      asOf,
      exemptFromNis: false,
      receivingNisRetirementBenefit: false,
      categoryOverride: "EXEMPT",
      overrideEffectiveFrom: "2026-01-01",
    });

    expect(result.category).toBe("EXEMPT");
  });
});
