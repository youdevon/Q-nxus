import { describe, expect, it } from "vitest";

import {
  normalizeAchAccountType,
  validateAchEmployeeInstructionFields,
} from "./ach-employee-fields";

describe("ach employee fields", () => {
  it("normalizes Current to Chequing for ACH Payment Type", () => {
    expect(normalizeAchAccountType("Current")).toBe("CHEQUING");
    expect(normalizeAchAccountType("Savings")).toBe("SAVINGS");
    expect(normalizeAchAccountType("OTHER")).toBeNull();
  });

  it("requires holder, institution, account number, and type", () => {
    const ok = validateAchEmployeeInstructionFields({
      bankName: "First Citizens",
      accountNumber: "12345678",
      accountHolderName: "Jane Doe",
      accountType: "SAVINGS",
    });
    expect(ok.ok).toBe(true);

    const missing = validateAchEmployeeInstructionFields({
      bankName: "",
      accountNumber: "12",
      accountHolderName: "",
      accountType: "OTHER",
    });
    expect(missing.ok).toBe(false);
    expect(missing.errors.length).toBeGreaterThanOrEqual(3);
  });
});
