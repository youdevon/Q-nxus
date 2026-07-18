import { describe, expect, it } from "vitest";

import {
  isFullEmployee,
  isNonEmployeePayee,
  parseWorkforceCategory,
  requiresEmployeeFile,
  suggestedContractTypeForCategory,
  WorkforceCategory,
  workforceCategoryBadgeLabel,
} from "@/src/modules/hr/lib/workforce-category";

describe("workforce-category helpers", () => {
  it("treats EMPLOYEE and missing as full employees", () => {
    expect(isFullEmployee(WorkforceCategory.EMPLOYEE)).toBe(true);
    expect(isFullEmployee(null)).toBe(true);
    expect(isFullEmployee(undefined)).toBe(true);
    expect(isFullEmployee("")).toBe(true);
  });

  it("treats AGENT / BOARD / CONTRACTOR as non-employee payees", () => {
    for (const category of [
      WorkforceCategory.AGENT,
      WorkforceCategory.BOARD,
      WorkforceCategory.CONTRACTOR,
    ]) {
      expect(isFullEmployee(category)).toBe(false);
      expect(isNonEmployeePayee(category)).toBe(true);
      expect(requiresEmployeeFile(category)).toBe(false);
    }
  });

  it("requires employee files only for full employees", () => {
    expect(requiresEmployeeFile(WorkforceCategory.EMPLOYEE)).toBe(true);
    expect(requiresEmployeeFile(WorkforceCategory.BOARD)).toBe(false);
  });

  it("returns badge labels only for non-employee categories", () => {
    expect(workforceCategoryBadgeLabel(WorkforceCategory.EMPLOYEE)).toBeNull();
    expect(workforceCategoryBadgeLabel(WorkforceCategory.AGENT)).toBe("Agent");
    expect(workforceCategoryBadgeLabel(WorkforceCategory.BOARD)).toBe("Board");
    expect(workforceCategoryBadgeLabel(WorkforceCategory.CONTRACTOR)).toBe(
      "Contractor",
    );
  });

  it("suggests engagement contract types for payees", () => {
    expect(suggestedContractTypeForCategory(WorkforceCategory.CONTRACTOR)).toBe(
      "CONSULTANCY",
    );
    expect(suggestedContractTypeForCategory(WorkforceCategory.BOARD)).toBe(
      "OTHER",
    );
    expect(suggestedContractTypeForCategory(WorkforceCategory.AGENT)).toBe(
      "OTHER",
    );
    expect(suggestedContractTypeForCategory(WorkforceCategory.EMPLOYEE)).toBe(
      "FIXED_TERM",
    );
  });

  it("parses valid workforce category values", () => {
    expect(parseWorkforceCategory("BOARD")).toBe(WorkforceCategory.BOARD);
    expect(parseWorkforceCategory("invalid")).toBeNull();
    expect(parseWorkforceCategory(undefined)).toBeNull();
  });
});
