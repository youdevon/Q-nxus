import { describe, expect, it } from "vitest";

import { evaluatePayeExceptions } from "@/src/modules/payroll/lib/paye-exceptions";

describe("evaluatePayeExceptions", () => {
  it("warns when prior employment is declared without records", () => {
    expect(
      evaluatePayeExceptions({
        previousEmploymentDeclared: true,
        priorEmploymentRecordCount: 0,
        priorEmploymentAllVerified: true,
        cumulativeEnabled: false,
      }),
    ).toEqual([
      "Previous employment declared but no prior-employer YTD records on file.",
    ]);
  });

  it("warns on unverified prior YTD under cumulative", () => {
    const warnings = evaluatePayeExceptions({
      previousEmploymentDeclared: true,
      priorEmploymentRecordCount: 1,
      priorEmploymentAllVerified: false,
      cumulativeEnabled: true,
      pendingOverrideCount: 2,
    });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/unverified/);
    expect(warnings[1]).toMatch(/pending approval/);
  });
});
