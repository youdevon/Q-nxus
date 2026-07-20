import { describe, expect, it } from "vitest";

import {
  applyRecurringItemsForPeriod,
  computeBalanceAfterPost,
  expectedKindForCategory,
  isRecurringItemActiveForPeriod,
  resolveRecurringItemPeriodAmount,
  type RecurringItemInput,
} from "@/src/modules/payroll/lib/recurring-payroll-items";

function loanItem(
  overrides: Partial<RecurringItemInput> &
    Pick<RecurringItemInput, "id" | "amount">,
): RecurringItemInput {
  return {
    remainingBalance: null,
    startDate: "2026-01-01",
    endDate: null,
    isActive: true,
    definition: {
      code: "LOAN-001",
      name: "Staff loan",
      kind: "DEDUCTION",
      category: "LOAN",
      isTaxable: false,
      isActive: true,
    },
    ...overrides,
  };
}

describe("resolveRecurringItemPeriodAmount", () => {
  it("returns the scheduled amount when no balance is tracked", () => {
    expect(
      resolveRecurringItemPeriodAmount({ amount: 500, remainingBalance: null }),
    ).toBe(500);
  });

  it("caps amount by remaining balance", () => {
    expect(
      resolveRecurringItemPeriodAmount({
        amount: 500,
        remainingBalance: 120.5,
      }),
    ).toBe(120.5);
  });

  it("returns 0 when balance is exhausted", () => {
    expect(
      resolveRecurringItemPeriodAmount({
        amount: 500,
        remainingBalance: 0,
      }),
    ).toBe(0);
  });
});

describe("isRecurringItemActiveForPeriod", () => {
  it("skips inactive assignments and inactive definitions", () => {
    expect(
      isRecurringItemActiveForPeriod(
        loanItem({ id: "a", amount: 100, isActive: false }),
        "2026-07-01",
        "2026-07-31",
      ),
    ).toBe(false);

    expect(
      isRecurringItemActiveForPeriod(
        loanItem({
          id: "b",
          amount: 100,
          definition: {
            code: "LOAN-001",
            name: "Staff loan",
            kind: "DEDUCTION",
            category: "LOAN",
            isTaxable: false,
            isActive: false,
          },
        }),
        "2026-07-01",
        "2026-07-31",
      ),
    ).toBe(false);
  });

  it("filters by date range coverage of the period", () => {
    const item = loanItem({
      id: "c",
      amount: 100,
      startDate: "2026-06-15",
      endDate: "2026-08-15",
    });

    expect(
      isRecurringItemActiveForPeriod(item, "2026-07-01", "2026-07-31"),
    ).toBe(true);
    expect(
      isRecurringItemActiveForPeriod(item, "2026-05-01", "2026-05-31"),
    ).toBe(false);
    expect(
      isRecurringItemActiveForPeriod(item, "2026-09-01", "2026-09-30"),
    ).toBe(false);
  });

  it("treats null endDate as open-ended", () => {
    expect(
      isRecurringItemActiveForPeriod(
        loanItem({
          id: "d",
          amount: 100,
          startDate: "2026-01-01",
          endDate: null,
        }),
        "2026-12-01",
        "2026-12-31",
      ),
    ).toBe(true);
  });
});

describe("applyRecurringItemsForPeriod", () => {
  it("maps active items to stable-coded lines and skips inactive", () => {
    const lines = applyRecurringItemsForPeriod(
      [
        loanItem({
          id: "active",
          amount: 250,
          remainingBalance: 1000,
        }),
        loanItem({
          id: "inactive",
          amount: 100,
          isActive: false,
        }),
        loanItem({
          id: "earning",
          amount: 75,
          definition: {
            code: "ALLOW-TRN",
            name: "Transport allowance",
            kind: "EARNING",
            category: "RECURRING_EARNING",
            isTaxable: true,
            isActive: true,
          },
        }),
      ],
      "2026-07-01",
      "2026-07-31",
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      recurringItemId: "active",
      code: "LOAN-001",
      amount: 250,
      kind: "DEDUCTION",
    });
    expect(lines[0]?.detail).toContain("LOAN-001");
    expect(lines[1]).toMatchObject({
      code: "ALLOW-TRN",
      amount: 75,
      kind: "EARNING",
      isTaxable: true,
    });
  });

  it("applies balance cap when assembling lines", () => {
    const lines = applyRecurringItemsForPeriod(
      [
        loanItem({
          id: "capped",
          amount: 500,
          remainingBalance: 80,
        }),
      ],
      "2026-07-01",
      "2026-07-31",
    );

    expect(lines).toEqual([
      expect.objectContaining({
        recurringItemId: "capped",
        amount: 80,
      }),
    ]);
  });
});

describe("computeBalanceAfterPost", () => {
  it("returns null for non-balance-tracked items", () => {
    expect(computeBalanceAfterPost(null, 100)).toBeNull();
  });

  it("decrements balance and keeps active while remaining", () => {
    expect(computeBalanceAfterPost(1000, 250)).toEqual({
      remainingBalance: 750,
      isActive: true,
      appliedAmount: 250,
    });
  });

  it("deactivates when balance hits zero", () => {
    expect(computeBalanceAfterPost(100, 100)).toEqual({
      remainingBalance: 0,
      isActive: false,
      appliedAmount: 100,
    });
  });

  it("does not go below zero", () => {
    expect(computeBalanceAfterPost(50, 200)).toEqual({
      remainingBalance: 0,
      isActive: false,
      appliedAmount: 50,
    });
  });
});

describe("expectedKindForCategory", () => {
  it("maps categories to earning or deduction", () => {
    expect(expectedKindForCategory("RECURRING_EARNING")).toBe("EARNING");
    expect(expectedKindForCategory("LOAN")).toBe("DEDUCTION");
    expect(expectedKindForCategory("GARNISHMENT")).toBe("DEDUCTION");
    expect(expectedKindForCategory("PENSION_INSTALLMENT")).toBe("DEDUCTION");
    expect(expectedKindForCategory("VOLUNTARY_DEDUCTION")).toBe("DEDUCTION");
  });
});
