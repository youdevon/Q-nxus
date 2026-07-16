import { describe, expect, it } from "vitest";

import {
  contractRangesOverlap,
  renewalOverlapsPrevious,
} from "@/src/lib/contract-overlap";
import {
  earliestRenewalStartDate,
  calculateContractEndDate,
} from "@/src/lib/contract-dates";

describe("contract non-overlap date rules", () => {
  it("detects overlapping inclusive ranges", () => {
    expect(
      contractRangesOverlap(
        { startDate: "2026-01-01", endDate: "2026-12-31" },
        { startDate: "2026-06-01", endDate: "2027-05-31" },
      ),
    ).toBe(true);

    expect(
      contractRangesOverlap(
        { startDate: "2026-01-01", endDate: "2026-12-31" },
        { startDate: "2027-01-01", endDate: "2027-12-31" },
      ),
    ).toBe(false);
  });

  it("treats null end date as open-ended", () => {
    expect(
      contractRangesOverlap(
        { startDate: "2025-01-01", endDate: null },
        { startDate: "2026-01-01", endDate: "2026-12-31" },
      ),
    ).toBe(true);
  });

  it("requires renewal start after previous effective end", () => {
    expect(
      renewalOverlapsPrevious({
        previousEndDate: "2026-12-31",
        previousTerminationDate: null,
        previousStatus: "ACTIVE",
        renewalStartDate: "2026-12-31",
      }),
    ).toBe(true);

    expect(
      renewalOverlapsPrevious({
        previousEndDate: "2026-12-31",
        previousTerminationDate: null,
        previousStatus: "ACTIVE",
        renewalStartDate: "2027-01-01",
      }),
    ).toBe(false);

    expect(
      earliestRenewalStartDate({
        endDate: "2026-12-31",
        terminationDate: null,
        status: "ACTIVE",
      }),
    ).toBe("2027-01-01");
  });

  it("uses termination date when previous contract closed early", () => {
    expect(
      renewalOverlapsPrevious({
        previousEndDate: "2027-12-31",
        previousTerminationDate: "2026-06-15",
        previousStatus: "TERMINATED",
        renewalStartDate: "2026-06-15",
      }),
    ).toBe(true);

    expect(
      earliestRenewalStartDate({
        endDate: "2027-12-31",
        terminationDate: "2026-06-15",
        status: "TERMINATED",
      }),
    ).toBe("2026-06-16");
  });

  it("calculates fixed-period end dates without anniversary overlap", () => {
    expect(calculateContractEndDate("2026-01-15", 1)).toBe("2027-01-14");
    expect(calculateContractEndDate("2026-03-01", 1)).toBe("2027-02-28");
  });
});
