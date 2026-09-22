import { describe, expect, it } from "vitest";

import type { ContractMonitoringRecord } from "@/src/modules/hr/data/get-employment-contracts";
import {
  contractMatchesExpiryWindow,
  isContractExpiryCandidate,
  parseContractExpiryWindow,
} from "@/src/modules/reports/lib/contract-expiry-filters";

function contract(
  overrides: Partial<ContractMonitoringRecord> = {},
): ContractMonitoringRecord {
  return {
    id: "c1",
    employeeId: "e1",
    employeeNumber: "E001",
    employeeName: "Ada Lovelace",
    contractNumber: "C-001",
    positionTitle: "Engineer",
    contractType: "FIXED_TERM",
    status: "ACTIVE",
    startDate: "2025-01-01",
    endDate: "2026-12-31",
    baseSalary: "5000",
    currency: "TTD",
    isCurrent: true,
    daysUntilExpiry: 120,
    expiryCategory: "LATER",
    gratuityEligible: false,
    estimatedGrossEarnings: null,
    estimatedGrossGratuity: null,
    estimatedTax: null,
    estimatedNetGratuity: null,
    ...overrides,
  };
}

describe("parseContractExpiryWindow", () => {
  it("defaults to all upcoming", () => {
    expect(parseContractExpiryWindow(undefined)).toBe("all");
    expect(parseContractExpiryWindow("invalid")).toBe("all");
  });
});

describe("isContractExpiryCandidate", () => {
  it("includes active current contracts with end dates", () => {
    expect(isContractExpiryCandidate(contract())).toBe(true);
  });

  it("excludes permanent contracts without end dates", () => {
    expect(
      isContractExpiryCandidate(
        contract({
          contractType: "PERMANENT",
          endDate: null,
          expiryCategory: "NO_END_DATE",
        }),
      ),
    ).toBe(false);
  });

  it("includes expired contracts even when not current", () => {
    expect(
      isContractExpiryCandidate(
        contract({
          isCurrent: false,
          status: "EXPIRED",
          expiryCategory: "EXPIRED",
          daysUntilExpiry: -10,
        }),
      ),
    ).toBe(true);
  });

  it("excludes draft contracts", () => {
    expect(
      isContractExpiryCandidate(
        contract({
          status: "DRAFT",
        }),
      ),
    ).toBe(false);
  });
});

describe("contractMatchesExpiryWindow", () => {
  it("includes later expiries in the all-upcoming window", () => {
    expect(contractMatchesExpiryWindow(contract(), "all")).toBe(true);
  });

  it("excludes later expiries from the 90-day window", () => {
    expect(contractMatchesExpiryWindow(contract(), "90")).toBe(false);
  });
});
