/**
 * Posted payroll analytics — org monthly summary and employee payment history.
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
import { getPreviousPayslipPeriod } from "@/src/modules/payroll/lib/payslip-preview";
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

export type PayrollRunKindTotals = PayrollMoneyTotals & {
  runKind: PayRunKindAnalytics;
  payslipCount: number;
  employeeCount: number;
};

export type PayrollRunRowTotals = PayrollMoneyTotals & {
  payRunId: string;
  runNumber: string;
  runKind: PayRunKindAnalytics;
  postedAt: string | null;
  payslipCount: number;
  employeeCount: number;
};

export type MonthlyPayrollSummary = {
  periodKey: string;
  periodName: string | null;
  payslipCount: number;
  employeeCount: number;
  totalsByCurrency: PayrollMoneyTotals[];
  byRunKind: PayrollRunKindTotals[];
  runs: PayrollRunRowTotals[];
};

export type EmployeePaymentMonthBucket = {
  periodKey: string;
  periodName: string;
  payslips: PostedPayslipAnalyticsRow[];
  totalsByCurrency: PayrollMoneyTotals[];
};

export type EmployeePaymentHistory = {
  employeeId: string;
  startPeriodKey: string;
  endPeriodKey: string;
  payslipCount: number;
  runCount: number;
  totalsByCurrency: PayrollMoneyTotals[];
  byRunKind: PayrollRunKindTotals[];
  months: EmployeePaymentMonthBucket[];
};

/** Scope for the employee payment history report. */
export type EmployeePaymentHistoryScope =
  | "all"
  | "employee"
  | "department";

/** One employee’s posted totals within a multi-employee roster. */
export type EmployeePaymentRosterRow = {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  payslipCount: number;
  totalsByCurrency: PayrollMoneyTotals[];
};

/**
 * Aggregated posted payment history across many employees
 * (org-wide or department-scoped).
 */
export type EmployeePaymentRoster = {
  startPeriodKey: string;
  endPeriodKey: string;
  employeeCount: number;
  payslipCount: number;
  runCount: number;
  totalsByCurrency: PayrollMoneyTotals[];
  byRunKind: PayrollRunKindTotals[];
  employees: EmployeePaymentRosterRow[];
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

function aggregateByRunKind(
  rows: PostedPayslipAnalyticsRow[],
): PayrollRunKindTotals[] {
  const kinds: PayRunKindAnalytics[] = ["REGULAR", "CORRECTION", "OFF_CYCLE"];
  const result: PayrollRunKindTotals[] = [];

  for (const runKind of kinds) {
    const kindRows = rows.filter((row) => row.runKind === runKind);
    if (kindRows.length === 0) {
      continue;
    }

    const totals = totalsListFromRows(kindRows);
    for (const total of totals) {
      result.push({
        ...total,
        runKind,
        payslipCount: kindRows.filter((row) => row.currency === total.currency)
          .length,
        employeeCount: uniqueEmployeeCount(
          kindRows.filter((row) => row.currency === total.currency),
        ),
      });
    }
  }

  return result;
}

function aggregateByRun(
  rows: PostedPayslipAnalyticsRow[],
): PayrollRunRowTotals[] {
  const byRun = new Map<string, PostedPayslipAnalyticsRow[]>();

  for (const row of rows) {
    const list = byRun.get(row.payRunId) ?? [];
    list.push(row);
    byRun.set(row.payRunId, list);
  }

  const result: PayrollRunRowTotals[] = [];

  for (const [, runRows] of byRun) {
    const first = runRows[0]!;
    const totals = totalsListFromRows(runRows);

    for (const total of totals) {
      const currencyRows = runRows.filter(
        (row) => row.currency === total.currency,
      );
      result.push({
        ...total,
        payRunId: first.payRunId,
        runNumber: first.runNumber,
        runKind: first.runKind,
        postedAt: first.postedAt,
        payslipCount: currencyRows.length,
        employeeCount: uniqueEmployeeCount(currencyRows),
      });
    }
  }

  return result.sort((a, b) => {
    const postedA = a.postedAt ?? "";
    const postedB = b.postedAt ?? "";
    if (postedA !== postedB) {
      return postedB.localeCompare(postedA);
    }
    return a.runNumber.localeCompare(b.runNumber);
  });
}

export function assembleMonthlyPayrollSummary(input: {
  periodKey: string;
  periodName?: string | null;
  rows: PostedPayslipAnalyticsRow[];
}): MonthlyPayrollSummary {
  const rows = input.rows.filter(
    (row) => row.periodKey === input.periodKey,
  );

  return {
    periodKey: input.periodKey,
    periodName: input.periodName ?? rows[0]?.periodName ?? null,
    payslipCount: rows.length,
    employeeCount: uniqueEmployeeCount(rows),
    totalsByCurrency: totalsListFromRows(rows),
    byRunKind: aggregateByRunKind(rows),
    runs: aggregateByRun(rows),
  };
}

export function assembleEmployeePaymentHistory(input: {
  employeeId: string;
  startPeriodKey: string;
  endPeriodKey: string;
  rows: PostedPayslipAnalyticsRow[];
}): EmployeePaymentHistory {
  const rows = input.rows
    .filter(
      (row) =>
        row.employeeId === input.employeeId &&
        isPeriodKeyInInclusiveRange(
          row.periodKey,
          input.startPeriodKey,
          input.endPeriodKey,
        ),
    )
    .sort((a, b) => {
      const periodCmp = comparePeriodKeys(a.periodKey, b.periodKey);
      if (periodCmp !== 0) {
        return periodCmp;
      }
      const postedA = a.postedAt ?? "";
      const postedB = b.postedAt ?? "";
      if (postedA !== postedB) {
        return postedA.localeCompare(postedB);
      }
      return a.runNumber.localeCompare(b.runNumber);
    });

  const byMonth = new Map<string, PostedPayslipAnalyticsRow[]>();
  for (const row of rows) {
    const list = byMonth.get(row.periodKey) ?? [];
    list.push(row);
    byMonth.set(row.periodKey, list);
  }

  const months: EmployeePaymentMonthBucket[] = [...byMonth.entries()]
    .sort(([a], [b]) => comparePeriodKeys(a, b))
    .map(([periodKey, monthRows]) => ({
      periodKey,
      periodName: monthRows[0]?.periodName ?? periodKey,
      payslips: monthRows,
      totalsByCurrency: totalsListFromRows(monthRows),
    }));

  return {
    employeeId: input.employeeId,
    startPeriodKey: input.startPeriodKey,
    endPeriodKey: input.endPeriodKey,
    payslipCount: rows.length,
    runCount: new Set(rows.map((row) => row.payRunId)).size,
    totalsByCurrency: totalsListFromRows(rows),
    byRunKind: aggregateByRunKind(rows),
    months,
  };
}

/**
 * Aggregate POSTED payslips across employees for a period range.
 * Rows outside the inclusive month range are dropped.
 * `departmentsByEmployeeId` supplies live department names for the table.
 */
export function assembleEmployeePaymentRoster(input: {
  startPeriodKey: string;
  endPeriodKey: string;
  rows: PostedPayslipAnalyticsRow[];
  departmentsByEmployeeId?: ReadonlyMap<string, string | null>;
}): EmployeePaymentRoster {
  const rows = input.rows
    .filter((row) =>
      isPeriodKeyInInclusiveRange(
        row.periodKey,
        input.startPeriodKey,
        input.endPeriodKey,
      ),
    )
    .sort((a, b) => {
      const nameCmp = a.employeeName.localeCompare(b.employeeName);
      if (nameCmp !== 0) {
        return nameCmp;
      }
      const numberCmp = a.employeeNumber.localeCompare(b.employeeNumber);
      if (numberCmp !== 0) {
        return numberCmp;
      }
      return comparePeriodKeys(a.periodKey, b.periodKey);
    });

  const byEmployee = new Map<string, PostedPayslipAnalyticsRow[]>();
  for (const row of rows) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row);
    byEmployee.set(row.employeeId, list);
  }

  const employees: EmployeePaymentRosterRow[] = [...byEmployee.entries()]
    .map(([employeeId, employeeRows]) => {
      const first = employeeRows[0]!;
      const departmentName =
        input.departmentsByEmployeeId?.get(employeeId) ?? null;

      return {
        employeeId,
        employeeNumber: first.employeeNumber,
        employeeName: first.employeeName,
        departmentName,
        payslipCount: employeeRows.length,
        totalsByCurrency: totalsListFromRows(employeeRows),
      };
    })
    .sort((a, b) => {
      const nameCmp = a.employeeName.localeCompare(b.employeeName);
      if (nameCmp !== 0) {
        return nameCmp;
      }
      return a.employeeNumber.localeCompare(b.employeeNumber);
    });

  return {
    startPeriodKey: input.startPeriodKey,
    endPeriodKey: input.endPeriodKey,
    employeeCount: employees.length,
    payslipCount: rows.length,
    runCount: new Set(rows.map((row) => row.payRunId)).size,
    totalsByCurrency: totalsListFromRows(rows),
    byRunKind: aggregateByRunKind(rows),
    employees,
  };
}

export function resolveEmployeePaymentHistoryScope(
  value?: string | null,
  options?: { employeeId?: string | null },
): EmployeePaymentHistoryScope {
  const raw = value?.trim();
  if (raw === "all" || raw === "employee" || raw === "department") {
    return raw;
  }

  // Preserve deep links that only pass employeeId.
  if (options?.employeeId?.trim()) {
    return "employee";
  }

  return "all";
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
