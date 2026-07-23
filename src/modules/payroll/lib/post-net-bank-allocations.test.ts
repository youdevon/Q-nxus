import { describe, expect, it } from "vitest";

import { applyPostNetBankAllocations } from "./post-net-bank-allocations";

describe("applyPostNetBankAllocations", () => {
  it("resolves 20k → 3k fixed, 25%, remainder (spec example)", () => {
    const result = applyPostNetBankAllocations({
      availableAfterStatutory: 20_000,
      accounts: [
        {
          bankName: "Fixed Bank",
          accountNumber: "111100001111",
          fixedAmount: 3_000,
          percentage: null,
          kind: "FIXED",
          priority: 1,
        },
        {
          bankName: "Percent Bank",
          accountNumber: "222200002222",
          fixedAmount: null,
          percentage: 25,
          kind: "PERCENTAGE",
          priority: 2,
        },
        {
          bankName: "Remainder Bank",
          accountNumber: "333300003333",
          fixedAmount: null,
          percentage: null,
          kind: "REMAINDER",
          priority: 99,
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.deductions).toEqual([]);
    expect(result.lines).toEqual([
      {
        bankName: "Fixed Bank",
        accountNumber: "111100001111",
        accountNumberMasked: "••••1111",
        amount: 3_000,
        kind: "FIXED",
      accountType: null,
      },
      {
        bankName: "Percent Bank",
        accountNumber: "222200002222",
        accountNumberMasked: "••••2222",
        amount: 5_000,
        kind: "PERCENTAGE",
      accountType: null,
      },
      {
        bankName: "Remainder Bank",
        accountNumber: "333300003333",
        accountNumberMasked: "••••3333",
        amount: 12_000,
        kind: "REMAINDER",
      accountType: null,
      },
    ]);
    expect(result.allocatedTotal).toBe(20_000);
    expect(result.remainderAmount).toBe(12_000);
  });

  it("rejects percentage totals over 100%", () => {
    const result = applyPostNetBankAllocations({
      availableAfterStatutory: 10_000,
      accounts: [
        {
          bankName: "A",
          accountNumber: "1",
          fixedAmount: null,
          percentage: 60,
          kind: "PERCENTAGE",
          priority: 1,
        },
        {
          bankName: "B",
          accountNumber: "2",
          fixedAmount: null,
          percentage: 50,
          kind: "PERCENTAGE",
          priority: 2,
        },
        {
          bankName: "R",
          accountNumber: "3",
          fixedAmount: null,
          percentage: null,
          kind: "REMAINDER",
          priority: 3,
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exceeds 100%/);
  });

  it("rejects fixed amounts that exceed net", () => {
    const result = applyPostNetBankAllocations({
      availableAfterStatutory: 1_000,
      accounts: [
        {
          bankName: "A",
          accountNumber: "1",
          fixedAmount: 1_500,
          percentage: null,
          kind: "FIXED",
          priority: 1,
        },
        {
          bankName: "R",
          accountNumber: "2",
          fixedAmount: null,
          percentage: null,
          kind: "REMAINDER",
          priority: 2,
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exceed net pay/);
  });

  it("gives rounding residue to remainder", () => {
    const result = applyPostNetBankAllocations({
      availableAfterStatutory: 100,
      accounts: [
        {
          bankName: "Pct",
          accountNumber: "1",
          fixedAmount: null,
          percentage: 33.33,
          kind: "PERCENTAGE",
          priority: 1,
        },
        {
          bankName: "Rem",
          accountNumber: "2",
          fixedAmount: null,
          percentage: null,
          kind: "REMAINDER",
          priority: 2,
        },
      ],
    });
    expect(result.ok).toBe(true);
    const pct = result.lines.find((line) => line.kind === "PERCENTAGE")!;
    const rem = result.lines.find((line) => line.kind === "REMAINDER")!;
    expect(pct.amount + rem.amount).toBe(100);
    expect(rem.amount).toBe(100 - pct.amount);
  });
});
