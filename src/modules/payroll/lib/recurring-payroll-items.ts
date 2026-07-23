/**
 * Recurring earning/deduction masters — period eligibility, balance capping,
 * and post-time balance decrement (Payroll Phase A).
 */

import { roundToCents } from "@/src/modules/payroll/lib/money";

export type RecurringComponentKind = "EARNING" | "DEDUCTION";

export type RecurringComponentCategory =
  | "LOAN"
  | "GARNISHMENT"
  | "PENSION_INSTALLMENT"
  | "VOLUNTARY_DEDUCTION"
  | "RECURRING_EARNING";

export type RecurringItemDefinitionInput = {
  /** Component definition id — required to apply earning treatment overrides. */
  id?: string;
  code: string;
  name: string;
  kind: RecurringComponentKind;
  category: RecurringComponentCategory;
  isTaxable: boolean;
  isActive: boolean;
};

export type EarningTreatmentOverrideLookup = {
  isTaxable: boolean;
  includeInProjectedEarnings?: boolean;
};

export type RecurringItemInput = {
  id: string;
  amount: number;
  remainingBalance: number | null;
  startDate: Date | string;
  endDate: Date | string | null;
  isActive: boolean;
  definition: RecurringItemDefinitionInput;
};

export type AppliedRecurringLine = {
  recurringItemId: string;
  code: string;
  label: string;
  category: RecurringComponentCategory;
  kind: RecurringComponentKind;
  amount: number;
  isTaxable: boolean;
  remainingBalance: number | null;
  detail: string;
};

export type BalanceDecrementResult = {
  remainingBalance: number;
  isActive: boolean;
  appliedAmount: number;
};

function toDateOnlyIso(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function categoryLabel(category: RecurringComponentCategory): string {
  return category.replaceAll("_", " ").toLowerCase();
}

/**
 * True when the assignment and its definition are active and the period
 * overlaps [startDate, endDate] (endDate null = open-ended).
 */
export function isRecurringItemActiveForPeriod(
  item: Pick<
    RecurringItemInput,
    "isActive" | "startDate" | "endDate" | "definition"
  >,
  periodStart: Date | string,
  periodEnd: Date | string,
): boolean {
  if (!item.isActive || !item.definition.isActive) {
    return false;
  }

  const periodStartIso = toDateOnlyIso(periodStart);
  const periodEndIso = toDateOnlyIso(periodEnd);
  const startIso = toDateOnlyIso(item.startDate);
  const endIso = item.endDate != null ? toDateOnlyIso(item.endDate) : null;

  if (startIso > periodEndIso) {
    return false;
  }
  if (endIso != null && endIso < periodStartIso) {
    return false;
  }

  return true;
}

/**
 * Fixed period amount, capped by remainingBalance when balance-tracked.
 * Returns 0 when inactive, exhausted, or non-finite.
 */
export function resolveRecurringItemPeriodAmount(
  item: Pick<RecurringItemInput, "amount" | "remainingBalance">,
): number {
  const scheduled = roundToCents(item.amount);
  if (!Number.isFinite(scheduled) || scheduled <= 0) {
    return 0;
  }

  if (item.remainingBalance == null) {
    return scheduled;
  }

  const balance = roundToCents(item.remainingBalance);
  if (!Number.isFinite(balance) || balance <= 0) {
    return 0;
  }

  return Math.min(scheduled, balance);
}

/**
 * Filter active-in-period items and map to payslip earning/deduction lines
 * with stable definition codes. Optional treatment overrides replace isTaxable
 * when an approved override exists for the component definition.
 */
export function applyRecurringItemsForPeriod(
  items: RecurringItemInput[],
  periodStart: Date | string,
  periodEnd: Date | string,
  treatmentOverrides?: Map<string, EarningTreatmentOverrideLookup>,
): AppliedRecurringLine[] {
  const applied: AppliedRecurringLine[] = [];

  for (const item of items) {
    if (!isRecurringItemActiveForPeriod(item, periodStart, periodEnd)) {
      continue;
    }

    const amount = resolveRecurringItemPeriodAmount(item);
    if (amount <= 0) {
      continue;
    }

    const override =
      item.definition.id != null
        ? treatmentOverrides?.get(item.definition.id)
        : undefined;
    const isTaxable = override?.isTaxable ?? item.definition.isTaxable;

    const detailParts = [
      item.definition.code,
      categoryLabel(item.definition.category),
    ];
    if (override) {
      detailParts.push("treatment override");
    }
    if (item.remainingBalance != null) {
      detailParts.push(
        `balance ${roundToCents(item.remainingBalance).toFixed(2)}`,
      );
    }

    applied.push({
      recurringItemId: item.id,
      code: item.definition.code,
      label: item.definition.name,
      category: item.definition.category,
      kind: item.definition.kind,
      amount,
      isTaxable,
      remainingBalance: item.remainingBalance,
      detail: detailParts.join(" · "),
    });
  }

  return applied;
}

/**
 * Pure balance update after a posted period amount is applied.
 * Balance-tracked items deactivate when balance hits zero.
 * Non-balance-tracked items are unchanged (caller skips them).
 */
export function computeBalanceAfterPost(
  remainingBalance: number | null | undefined,
  appliedAmount: number,
): BalanceDecrementResult | null {
  if (remainingBalance == null) {
    return null;
  }

  const current = roundToCents(remainingBalance);
  const applied = roundToCents(Math.max(0, appliedAmount));
  const next = roundToCents(Math.max(0, current - applied));

  return {
    remainingBalance: next,
    isActive: next > 0,
    appliedAmount: Math.min(applied, current),
  };
}

/** Expected kind for each category (validated on create/update). */
export function expectedKindForCategory(
  category: RecurringComponentCategory,
): RecurringComponentKind {
  return category === "RECURRING_EARNING" ? "EARNING" : "DEDUCTION";
}
