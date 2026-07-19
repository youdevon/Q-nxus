import { describe, expect, it } from "vitest";

import {
  entitlementOverridesFromContractFields,
  formatLeaveOverrideDays,
} from "@/src/modules/hr/lib/contract-leave-overrides";

describe("entitlementOverridesFromContractFields", () => {
  it("omits null overrides so org rules apply", () => {
    expect(
      entitlementOverridesFromContractFields({
        vacationLeaveDaysOverride: null,
        sickLeaveDaysOverride: null,
      }),
    ).toEqual([]);
  });

  it("includes explicit zero vacation days", () => {
    expect(
      entitlementOverridesFromContractFields({
        vacationLeaveDaysOverride: 0,
        sickLeaveDaysOverride: null,
      }),
    ).toEqual([{ leaveTypeCode: "VAC", entitlementDays: 0 }]);
  });

  it("maps both vacation and sick overrides", () => {
    expect(
      entitlementOverridesFromContractFields({
        vacationLeaveDaysOverride: "12.5",
        sickLeaveDaysOverride: 10,
      }),
    ).toEqual([
      { leaveTypeCode: "VAC", entitlementDays: 12.5 },
      { leaveTypeCode: "SICK", entitlementDays: 10 },
    ]);
  });
});

describe("formatLeaveOverrideDays", () => {
  it("formats integers without decimals", () => {
    expect(formatLeaveOverrideDays(14)).toBe("14");
  });

  it("returns blank for null", () => {
    expect(formatLeaveOverrideDays(null)).toBe("");
  });
});
