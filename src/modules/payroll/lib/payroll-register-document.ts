import { roundToCents } from "@/src/modules/payroll/lib/money";
import { extractEmployerNisFromSnapshot } from "@/src/modules/payroll/lib/statutory-remittance";

/** Money columns shared with the pay-run paysheet register. */
export type PayrollRegisterMoneyTotals = {
  baseSalary: number;
  allowancesTotal: number;
  grossPay: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  nisEmployer: number;
  nisPayment: number;
};

export type PayrollRegisterSourceRow = {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  jobTitle: string | null;
  currency: string;
  baseSalary: number;
  allowancesTotal: number;
  grossPay: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  nisEmployer: number;
  nisPayment: number;
  periodKey: string;
  periodName: string;
  runNumber: string;
  runKind: "REGULAR" | "CORRECTION" | "OFF_CYCLE";
  postedAt: string | null;
};

export type PayrollRegisterDocumentRow = PayrollRegisterMoneyTotals & {
  key: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  jobTitle: string | null;
  currency: string;
  payslipCount: number;
  periodName: string | null;
  runNumber: string | null;
  runKind: "REGULAR" | "CORRECTION" | "OFF_CYCLE" | null;
};

export type PayrollRegisterDocument = {
  /**
   * `employee` — one calculated row per person (multi-employee / department / all).
   * `slip` — one row per posted payslip (single-employee payment history).
   */
  mode: "employee" | "slip";
  currency: string;
  employeeCount: number;
  payslipCount: number;
  rows: PayrollRegisterDocumentRow[];
  totals: PayrollRegisterMoneyTotals;
};

export function emptyPayrollRegisterMoneyTotals(): PayrollRegisterMoneyTotals {
  return {
    baseSalary: 0,
    allowancesTotal: 0,
    grossPay: 0,
    paye: 0,
    nisEmployee: 0,
    healthSurcharge: 0,
    otherDeductions: 0,
    totalDeductions: 0,
    netPay: 0,
    nisEmployer: 0,
    nisPayment: 0,
  };
}

export function mapPayslipToRegisterSource(row: {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  jobTitle: string | null;
  currency: string;
  baseSalary: { toString(): string } | null;
  allowancesTotal: { toString(): string } | null;
  grossPay: { toString(): string } | null;
  payeAmount: { toString(): string } | null;
  nisEmployeeAmount: { toString(): string } | null;
  healthSurchargeAmount: { toString(): string } | null;
  totalDeductions: { toString(): string } | null;
  netPay: { toString(): string } | null;
  snapshot: unknown;
  payrollPeriod: {
    periodKey: string;
    name: string;
  };
  payRun: {
    runNumber: string;
    runKind: "REGULAR" | "CORRECTION" | "OFF_CYCLE";
    postedAt: Date | null;
  };
}): PayrollRegisterSourceRow {
  const money = (value: { toString(): string } | null | undefined) =>
    value == null ? 0 : roundToCents(Number(value.toString()));

  const paye = money(row.payeAmount);
  const nisEmployee = money(row.nisEmployeeAmount);
  const healthSurcharge = money(row.healthSurchargeAmount);
  const totalDeductions = money(row.totalDeductions);
  const statutoryTotal = roundToCents(paye + nisEmployee + healthSurcharge);
  const otherDeductions = roundToCents(
    Math.max(0, totalDeductions - statutoryTotal),
  );
  const nisEmployer = extractEmployerNisFromSnapshot(row.snapshot);

  return {
    employeeId: row.employeeId,
    employeeNumber: row.employeeNumber,
    employeeName: row.employeeName,
    departmentName: row.departmentName,
    jobTitle: row.jobTitle,
    currency: row.currency || "TTD",
    baseSalary: money(row.baseSalary),
    allowancesTotal: money(row.allowancesTotal),
    grossPay: money(row.grossPay),
    paye,
    nisEmployee,
    healthSurcharge,
    otherDeductions,
    totalDeductions,
    netPay: money(row.netPay),
    nisEmployer,
    nisPayment: roundToCents(nisEmployee + nisEmployer),
    periodKey: row.payrollPeriod.periodKey,
    periodName: row.payrollPeriod.name || row.payrollPeriod.periodKey,
    runNumber: row.payRun.runNumber,
    runKind: row.payRun.runKind,
    postedAt: row.payRun.postedAt?.toISOString() ?? null,
  };
}

function addMoney(
  into: PayrollRegisterMoneyTotals,
  row: PayrollRegisterMoneyTotals,
): void {
  into.baseSalary = roundToCents(into.baseSalary + row.baseSalary);
  into.allowancesTotal = roundToCents(
    into.allowancesTotal + row.allowancesTotal,
  );
  into.grossPay = roundToCents(into.grossPay + row.grossPay);
  into.paye = roundToCents(into.paye + row.paye);
  into.nisEmployee = roundToCents(into.nisEmployee + row.nisEmployee);
  into.healthSurcharge = roundToCents(
    into.healthSurcharge + row.healthSurcharge,
  );
  into.otherDeductions = roundToCents(
    into.otherDeductions + row.otherDeductions,
  );
  into.totalDeductions = roundToCents(
    into.totalDeductions + row.totalDeductions,
  );
  into.netPay = roundToCents(into.netPay + row.netPay);
  into.nisEmployer = roundToCents(into.nisEmployer + row.nisEmployer);
  into.nisPayment = roundToCents(into.nisPayment + row.nisPayment);
}

function sumRows(rows: PayrollRegisterMoneyTotals[]): PayrollRegisterMoneyTotals {
  const totals = emptyPayrollRegisterMoneyTotals();
  for (const row of rows) {
    addMoney(totals, row);
  }
  return totals;
}

function pickPrimaryCurrency(rows: PayrollRegisterSourceRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.currency, (counts.get(row.currency) ?? 0) + 1);
  }
  let best = "TTD";
  let bestCount = -1;
  for (const [currency, count] of counts) {
    if (count > bestCount) {
      best = currency;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Build a paysheet-style register from posted payslips.
 * Multiple employees → one auto-calculated row per person.
 * One employee → one row per payslip (payment history).
 */
export function assemblePayrollRegisterDocument(input: {
  rows: PayrollRegisterSourceRow[];
  mode?: "employee" | "slip";
}): PayrollRegisterDocument {
  const source = [...input.rows].sort((a, b) => {
    const nameCmp = a.employeeName.localeCompare(b.employeeName);
    if (nameCmp !== 0) {
      return nameCmp;
    }
    const periodCmp = a.periodKey.localeCompare(b.periodKey);
    if (periodCmp !== 0) {
      return periodCmp;
    }
    return a.runNumber.localeCompare(b.runNumber);
  });

  const employeeIds = new Set(source.map((row) => row.employeeId));
  const mode =
    input.mode ??
    (employeeIds.size <= 1 && source.length > 0 ? "slip" : "employee");
  const currency = pickPrimaryCurrency(source);
  const scoped = source.filter((row) => row.currency === currency);

  if (mode === "slip") {
    const rows: PayrollRegisterDocumentRow[] = scoped.map((row) => ({
      key: `${row.employeeId}:${row.periodKey}:${row.runNumber}:${row.grossPay}:${row.netPay}`,
      employeeId: row.employeeId,
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      departmentName: row.departmentName,
      jobTitle: row.jobTitle,
      currency: row.currency,
      payslipCount: 1,
      periodName: row.periodName,
      runNumber: row.runNumber,
      runKind: row.runKind,
      baseSalary: row.baseSalary,
      allowancesTotal: row.allowancesTotal,
      grossPay: row.grossPay,
      paye: row.paye,
      nisEmployee: row.nisEmployee,
      healthSurcharge: row.healthSurcharge,
      otherDeductions: row.otherDeductions,
      totalDeductions: row.totalDeductions,
      netPay: row.netPay,
      nisEmployer: row.nisEmployer,
      nisPayment: row.nisPayment,
    }));

    return {
      mode,
      currency,
      employeeCount: employeeIds.size,
      payslipCount: rows.length,
      rows,
      totals: sumRows(rows),
    };
  }

  const byEmployee = new Map<string, PayrollRegisterSourceRow[]>();
  for (const row of scoped) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row);
    byEmployee.set(row.employeeId, list);
  }

  const rows: PayrollRegisterDocumentRow[] = [...byEmployee.entries()]
    .map(([employeeId, slips]) => {
      const first = slips[0]!;
      const last = slips[slips.length - 1]!;
      const money = sumRows(slips);
      return {
        key: employeeId,
        employeeId,
        employeeNumber: last.employeeNumber || first.employeeNumber,
        employeeName: last.employeeName || first.employeeName,
        departmentName: last.departmentName ?? first.departmentName,
        jobTitle: last.jobTitle ?? first.jobTitle,
        currency,
        payslipCount: slips.length,
        periodName: null,
        runNumber: null,
        runKind: null,
        ...money,
      } satisfies PayrollRegisterDocumentRow;
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return {
    mode,
    currency,
    employeeCount: rows.length,
    payslipCount: scoped.length,
    rows,
    totals: sumRows(rows),
  };
}
