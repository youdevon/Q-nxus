import { describe, expect, it } from "vitest";

import {
  resolvePriorTaxableFromPayslip,
  validatePriorPayslipWorksheet,
} from "./prior-payslip-worksheet";

describe("resolvePriorTaxableFromPayslip", () => {
  it("uses direct taxable / YTD PAY", () => {
    expect(
      resolvePriorTaxableFromPayslip({
        entryMode: "DIRECT",
        taxableIncomeYtd: 89_268,
      }),
    ).toEqual({
      entryMode: "DIRECT",
      taxableIncomeYtd: 89_268,
      grossEarningsYtd: null,
      nonTaxableAllowancesYtd: null,
    });
  });

  it("computes taxable from gross minus non-taxable (TRHA-style)", () => {
    expect(
      resolvePriorTaxableFromPayslip({
        entryMode: "WORKSHEET",
        grossEarningsYtd: 107_336.71,
        nonTaxableAllowancesYtd: 7_500,
      }),
    ).toEqual({
      entryMode: "WORKSHEET",
      taxableIncomeYtd: 99_836.71,
      grossEarningsYtd: 107_336.71,
      nonTaxableAllowancesYtd: 7_500,
    });
  });

  it("clamps non-taxable so taxable never goes negative", () => {
    expect(
      resolvePriorTaxableFromPayslip({
        entryMode: "WORKSHEET",
        grossEarningsYtd: 10_000,
        nonTaxableAllowancesYtd: 12_000,
      }).taxableIncomeYtd,
    ).toBe(0);
  });
});

describe("validatePriorPayslipWorksheet", () => {
  it("warns when worksheet gross is missing", () => {
    const resolved = resolvePriorTaxableFromPayslip({
      entryMode: "WORKSHEET",
      grossEarningsYtd: 0,
      nonTaxableAllowancesYtd: 0,
    });
    expect(validatePriorPayslipWorksheet(resolved).map((w) => w.code)).toEqual(
      expect.arrayContaining([
        "MISSING_GROSS_FOR_WORKSHEET",
        "WORKSHEET_ZERO_TAXABLE",
      ]),
    );
  });

  it("warns when taxable exceeds gross", () => {
    const warnings = validatePriorPayslipWorksheet({
      entryMode: "DIRECT",
      taxableIncomeYtd: 100_000,
      grossEarningsYtd: 90_000,
      nonTaxableAllowancesYtd: null,
    });
    expect(warnings.some((w) => w.code === "TAXABLE_EXCEEDS_GROSS")).toBe(true);
  });
});
