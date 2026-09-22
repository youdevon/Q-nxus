/**
 * Posted payroll analytics — period totals from POSTED payslip snapshots.
 *
 * Source of truth: POSTED payslip snapshot columns only (never live preview / draft).
 * EXCLUDED slips are ignored. Bank allocations are distribution of net, not extra cost.
 *
 * Formulas (per currency):
 * - Gross paid            = Σ payslip.grossPay
 * - Employee deductions   = Σ payslip.totalDeductions
 * - Net paid              = Σ payslip.netPay
 * - Employer contributions = Σ snapshot employer lines (NIS employer, etc.)
 * - Org payroll cost      = gross paid + employer contributions
 *   (bank fixed allocations are already inside deductions / net distribution)
 */

import {
  defaultMonthlyPeriodKey,
  parseMonthlyPeriodKey,
} from "@/src/modules/payroll/lib/pay-period";
import {
  addCents,
  fromCents,
  roundToCents,
  sumMoney,
  toCents,
} from "@/src/modules/payroll/lib/money";
import {
  formatPayslipPeriodLabel,
  getPreviousPayslipPeriod,
} from "@/src/modules/payroll/lib/payslip-preview";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";

export type PayRunKindAnalytics = "REGULAR" | "CORRECTION" | "OFF_CYCLE";

export type PostedPayslipAnalyticsRow = {
  payslipId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  currency: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  /** Employer cost from frozen snapshot (NIS employer, etc.). */
  employerContributions: number;
  periodKey: string;
  periodName: string;
  periodEnd: string;
  payRunId: string;
  runNumber: string;
  runKind: PayRunKindAnalytics;
  postedAt: string | null;
};

export type PayrollMoneyTotals = {
  currency: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  employerContributions: number;
  /** Gross + employer contributions — organization cost of payroll. */
  organizationCost: number;
};

export type MonthlyPayrollSummary = {
  /** Inclusive range start (`YYYY-MM`). */
  startPeriodKey: string;
  /** Inclusive range end (`YYYY-MM`). Same as start for a single month. */
  endPeriodKey: string;
  /**
   * @deprecated Prefer start/end. Kept as the end key for older callers.
   */
  periodKey: string;
  periodName: string | null;
  payslipCount: number;
  employeeCount: number;
  totalsByCurrency: PayrollMoneyTotals[];
};

export type EmployeeHistoryPeriodPreset =
  | "this_year"
  | "previous_year"
  | "last_3"
  | "last_6"
  | "last_12"
  | "custom";

export type ResolvedPeriodRange = {
  startPeriodKey: string;
  endPeriodKey: string;
  preset: EmployeeHistoryPeriodPreset;
};


function emptyMoneyTotals(currency: string): PayrollMoneyTotals {
  return {
    currency,
    grossPay: 0,
    totalDeductions: 0,
    netPay: 0,
    employerContributions: 0,
    organizationCost: 0,
  };
}

function finalizeMoneyTotals(
  currency: string,
  amounts: {
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    employerContributions: number;
  },
): PayrollMoneyTotals {
  const grossPay = roundToCents(amounts.grossPay);
  const employerContributions = roundToCents(amounts.employerContributions);

  return {
    currency,
    grossPay,
    totalDeductions: roundToCents(amounts.totalDeductions),
    netPay: roundToCents(amounts.netPay),
    employerContributions,
    organizationCost: roundToCents(grossPay + employerContributions),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Employer contribution from a frozen payslip snapshot.
 * Prefer `employerContributions[]`; fall back to `nis.employerMonthly`.
 * Never treats bank distribution as employer cost.
 */
export function extractEmployerContributionFromSnapshot(
  snapshot: unknown,
): number {
  const parsed = parsePayslipSnapshot(snapshot);

  if (parsed) {
    const lines = parsed.payslip.employerContributions;
    if (Array.isArray(lines) && lines.length > 0) {
      return sumMoney(...lines.map((line) => Number(line.amount) || 0));
    }

    const employerMonthly = parsed.payslip.nis?.employerMonthly;
    if (typeof employerMonthly === "number" && Number.isFinite(employerMonthly)) {
      return roundToCents(employerMonthly);
    }
  }

  if (!isRecord(snapshot)) {
    return 0;
  }

  const payslip = isRecord(snapshot.payslip) ? snapshot.payslip : null;
  if (!payslip) {
    return 0;
  }

  if (Array.isArray(payslip.employerContributions)) {
    const amounts = payslip.employerContributions
      .filter(
        (line): line is Record<string, unknown> =>
          isRecord(line) && typeof line.amount === "number",
      )
      .map((line) => line.amount as number);
    const sum = sumMoney(...amounts);
    if (sum !== 0) {
      return sum;
    }
  }

  const nis = isRecord(payslip.nis) ? payslip.nis : null;
  if (nis && typeof nis.employerMonthly === "number") {
    return roundToCents(nis.employerMonthly);
  }

  return 0;
}

export function comparePeriodKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isPeriodKeyInInclusiveRange(
  periodKey: string,
  startPeriodKey: string,
  endPeriodKey: string,
): boolean {
  if (!parseMonthlyPeriodKey(periodKey)) {
    return false;
  }

  return (
    comparePeriodKeys(periodKey, startPeriodKey) >= 0 &&
    comparePeriodKeys(periodKey, endPeriodKey) <= 0
  );
}

/** Shift a `YYYY-MM` key by `deltaMonths` (may be negative). */
export function shiftMonthlyPeriodKey(
  periodKey: string,
  deltaMonths: number,
): string | null {
  const parsed = parseMonthlyPeriodKey(periodKey);

  if (!parsed) {
    return null;
  }

  const absolute = parsed.year * 12 + (parsed.month - 1) + deltaMonths;
  const year = Math.floor(absolute / 12);
  const month = (absolute % 12) + 1;

  if (year < 1) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Default month for the org summary:
 * 1) most recent posted period key (by periodKey desc)
 * 2) else previous Trinidad calendar month
 * 3) else current Trinidad calendar month
 */
export function resolveDefaultMonthlyReportPeriodKey(input: {
  postedPeriodKeys: string[];
  referenceDate?: Date;
}): string {
  const posted = [
    ...new Set(
      input.postedPeriodKeys.filter((key) => parseMonthlyPeriodKey(key) != null),
    ),
  ].sort(comparePeriodKeys);

  if (posted.length > 0) {
    return posted[posted.length - 1]!;
  }

  const reference = input.referenceDate ?? new Date();
  return getPreviousPayslipPeriod(reference) || defaultMonthlyPeriodKey(reference);
}

export function resolveEmployeeHistoryPeriodRange(input: {
  preset?: string | null;
  startPeriodKey?: string | null;
  endPeriodKey?: string | null;
  referenceDate?: Date;
}): ResolvedPeriodRange {
  const reference = input.referenceDate ?? new Date();
  const currentKey = defaultMonthlyPeriodKey(reference);
  const current = parseMonthlyPeriodKey(currentKey)!;

  const presetRaw = input.preset?.trim() || "this_year";
  const preset = (
    [
      "this_year",
      "previous_year",
      "last_3",
      "last_6",
      "last_12",
      "custom",
    ] as const
  ).includes(presetRaw as EmployeeHistoryPeriodPreset)
    ? (presetRaw as EmployeeHistoryPeriodPreset)
    : "this_year";

  if (preset === "custom") {
    // Prefer explicit start/end; fall back to this year when invalid.
    let startKey = parseMonthlyPeriodKey(input.startPeriodKey ?? "")
      ? input.startPeriodKey!.trim()
      : `${current.year}-01`;
    let endKey = parseMonthlyPeriodKey(input.endPeriodKey ?? "")
      ? input.endPeriodKey!.trim()
      : currentKey;

    if (comparePeriodKeys(startKey, endKey) > 0) {
      [startKey, endKey] = [endKey, startKey];
    }

    return {
      startPeriodKey: startKey,
      endPeriodKey: endKey,
      preset: "custom",
    };
  }

  if (preset === "previous_year") {
    const year = current.year - 1;
    return {
      startPeriodKey: `${year}-01`,
      endPeriodKey: `${year}-12`,
      preset,
    };
  }

  if (preset === "last_3" || preset === "last_6" || preset === "last_12") {
    const months = preset === "last_3" ? 3 : preset === "last_6" ? 6 : 12;
    const startKey =
      shiftMonthlyPeriodKey(currentKey, -(months - 1)) ?? `${current.year}-01`;

    return {
      startPeriodKey: startKey,
      endPeriodKey: currentKey,
      preset,
    };
  }

  // this_year
  return {
    startPeriodKey: `${current.year}-01`,
    endPeriodKey: currentKey,
    preset: "this_year",
  };
}

function accumulateRows(rows: PostedPayslipAnalyticsRow[]) {
  const centsByCurrency = new Map<
    string,
    {
      grossPay: number;
      totalDeductions: number;
      netPay: number;
      employerContributions: number;
    }
  >();

  for (const row of rows) {
    const currency = row.currency || "TTD";
    const current = centsByCurrency.get(currency) ?? {
      grossPay: 0,
      totalDeductions: 0,
      netPay: 0,
      employerContributions: 0,
    };
    current.grossPay = addCents(current.grossPay, toCents(row.grossPay));
    current.totalDeductions = addCents(
      current.totalDeductions,
      toCents(row.totalDeductions),
    );
    current.netPay = addCents(current.netPay, toCents(row.netPay));
    current.employerContributions = addCents(
      current.employerContributions,
      toCents(row.employerContributions),
    );
    centsByCurrency.set(currency, current);
  }

  const byCurrency = new Map<
    string,
    {
      grossPay: number;
      totalDeductions: number;
      netPay: number;
      employerContributions: number;
    }
  >();

  for (const [currency, cents] of centsByCurrency) {
    byCurrency.set(currency, {
      grossPay: fromCents(cents.grossPay),
      totalDeductions: fromCents(cents.totalDeductions),
      netPay: fromCents(cents.netPay),
      employerContributions: fromCents(cents.employerContributions),
    });
  }

  return byCurrency;
}

function totalsListFromRows(
  rows: PostedPayslipAnalyticsRow[],
): PayrollMoneyTotals[] {
  const byCurrency = accumulateRows(rows);

  return [...byCurrency.entries()]
    .map(([currency, amounts]) => finalizeMoneyTotals(currency, amounts))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

function uniqueEmployeeCount(rows: PostedPayslipAnalyticsRow[]): number {
  return new Set(rows.map((row) => row.employeeId)).size;
}

/** Human-readable label for an inclusive month range. */
export function formatPayrollPeriodRangeLabel(
  startPeriodKey: string,
  endPeriodKey: string,
): string {
  if (startPeriodKey === endPeriodKey) {
    return formatPayslipPeriodLabel(startPeriodKey) ?? startPeriodKey;
  }

  const start =
    formatPayslipPeriodLabel(startPeriodKey) ?? startPeriodKey;
  const end = formatPayslipPeriodLabel(endPeriodKey) ?? endPeriodKey;
  return `${start} – ${end}`;
}

export function assembleMonthlyPayrollSummary(input: {
  /** Single-month shorthand — sets start and end to this key. */
  periodKey?: string;
  startPeriodKey?: string;
  endPeriodKey?: string;
  periodName?: string | null;
  rows: PostedPayslipAnalyticsRow[];
}): MonthlyPayrollSummary {
  const startPeriodKey =
    input.startPeriodKey ?? input.periodKey ?? input.endPeriodKey ?? "";
  const endPeriodKey =
    input.endPeriodKey ?? input.periodKey ?? input.startPeriodKey ?? "";

  const rows = input.rows.filter((row) =>
    isPeriodKeyInInclusiveRange(row.periodKey, startPeriodKey, endPeriodKey),
  );

  return {
    startPeriodKey,
    endPeriodKey,
    periodKey: endPeriodKey,
    periodName:
      input.periodName ??
      formatPayrollPeriodRangeLabel(startPeriodKey, endPeriodKey),
    payslipCount: rows.length,
    employeeCount: uniqueEmployeeCount(rows),
    totalsByCurrency: totalsListFromRows(rows),
  };
}

/** Empty totals helper for UI empty states. */
export function emptyPayrollMoneyTotals(
  currency = "TTD",
): PayrollMoneyTotals {
  return emptyMoneyTotals(currency);
}

export function runKindLabel(kind: PayRunKindAnalytics): string {
  switch (kind) {
    case "CORRECTION":
      return "Correction";
    case "OFF_CYCLE":
      return "Off-cycle";
    default:
      return "Regular";
  }
}
