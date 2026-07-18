import { describe, expect, it } from "vitest";

import {
  PAYROLL_BANKING_FEATURE_FLAGS,
  payrollBankingFeatureDefault,
} from "./payroll-banking-flags";

describe("payrollBankingFeatureDefault", () => {
  it("defaults dangerous flags to false when a FeatureControl row is missing", () => {
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.ACH_EXPORT_ENABLED,
      ),
    ).toBe(false);
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.POST_NET_SPLIT_ENABLED,
      ),
    ).toBe(false);
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.PERCENTAGE_ALLOCATION_ENABLED,
      ),
    ).toBe(false);
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_NEGATIVE_NET_PAY_EXPORT,
      ),
    ).toBe(false);
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_ZERO_NET_PAY_EXPORT,
      ),
    ).toBe(false);
  });

  it("defaults continuity flags to true", () => {
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.PAYROLL_BANKING_ENABLED,
      ),
    ).toBe(true);
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.MANUAL_PAYMENT_ENABLED,
      ),
    ).toBe(true);
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.CHEQUE_PAYMENT_ENABLED,
      ),
    ).toBe(true);
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.CASH_PAYMENT_ENABLED,
      ),
    ).toBe(true);
    expect(
      payrollBankingFeatureDefault(
        PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_UNVERIFIED_BANK_ACCOUNTS,
      ),
    ).toBe(true);
  });

  it("fail-closes unknown banking codes", () => {
    expect(payrollBankingFeatureDefault("UNKNOWN_BANKING_FLAG")).toBe(false);
  });
});
