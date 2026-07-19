import { describe, expect, it } from "vitest";

import {
  resolveCompliancePack,
  suggestMissingEmployeeFileItems,
  summarizeContractAmendment,
} from "@/src/modules/hr/lib/compliance-packs";

describe("compliance packs", () => {
  it("defaults to Trinidad and Tobago", () => {
    expect(resolveCompliancePack(null).jurisdiction).toBe("TT");
    expect(resolveCompliancePack("bb").jurisdiction).toBe("BB");
  });

  it("suggests activation when no active contract", () => {
    const suggestions = suggestMissingEmployeeFileItems({
      hasActiveContract: false,
      checklistMissingLabels: ["Copy of ID"],
      openUpdateRequestCount: 1,
    });

    expect(suggestions.some((row) => row.code === "ACTIVE_CONTRACT")).toBe(
      true,
    );
    expect(suggestions.some((row) => row.code === "CHECKLIST")).toBe(true);
    expect(suggestions.some((row) => row.code === "OPEN_REQUESTS")).toBe(true);
  });

  it("summarizes amendment deltas", () => {
    const summary = summarizeContractAmendment({
      changeType: "SALARY_ADJUSTMENT",
      previousSalary: "5000",
      nextSalary: "5500",
      previousJobTitle: "Clerk",
      nextJobTitle: "Clerk",
    });

    expect(summary).toContain("5500");
    expect(summary.toLowerCase()).toContain("salary");
  });
});
