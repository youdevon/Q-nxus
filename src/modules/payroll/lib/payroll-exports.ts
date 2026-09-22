import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import { moneyDiffCents, roundToCents, sumMoney } from "@/src/modules/payroll/lib/money";
import { toCsv } from "@/src/modules/payroll/lib/csv";
import {
  buildPayrollDisbursementCsv,
  buildPayrollDisbursementRows,
  buildPayrollDisbursementRowsFromPayslips,
  type PayrollDisbursementRunMeta,
} from "@/src/modules/payroll/lib/payroll-disbursement-export";

export { toCsv } from "@/src/modules/payroll/lib/csv";

/**
 * Bank payment CSV (schema v1) from payslip snapshots.
 * Prefer prepared payment allocations via buildBankPaymentCsvFromPaymentAllocations.
 */
export function buildBankPaymentCsv(input: {
  runNumber: string;
  periodKey?: string;
  periodEnd?: string;
  paymentDate?: string;
  rows: Array<{
    employeeNumber: string;
    employeeName: string;
    nisNumber?: string | null;
    birNumber?: string | null;
    currency: string;
    grossPay?: number;
    paye?: number;
    nisEmployee?: number;
    healthSurcharge?: number;
    netPay?: number;
    payslip: PayslipPreview;
  }>;
}): string {
  const periodEnd =
    input.periodEnd ??
    input.rows[0]?.payslip.period.asOf?.slice(0, 10) ??
    "";
  const run: PayrollDisbursementRunMeta = {
    runNumber: input.runNumber,
    periodKey: input.periodKey ?? input.rows[0]?.payslip.period.label ?? "",
    periodEnd,
    paymentDate: input.paymentDate ?? periodEnd,
  };

  const rows = buildPayrollDisbursementRowsFromPayslips({
    run,
    rows: input.rows.map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      nisNumber: row.nisNumber,
      birNumber: row.birNumber,
      currency: row.currency,
      grossPay: row.grossPay ?? row.payslip.grossPay,
      paye: row.paye ?? 0,
      nisEmployee: row.nisEmployee ?? 0,
      healthSurcharge: row.healthSurcharge ?? 0,
      netPay: row.netPay ?? row.payslip.netPay,
      payslip: row.payslip,
    })),
  });

  return buildPayrollDisbursementCsv(rows);
}

/** Prefer frozen PayrollPaymentAllocation snapshots when payments are prepared. */
export function buildBankPaymentCsvFromPaymentAllocations(input: {
  runNumber: string;
  periodKey?: string;
  periodEnd?: string;
  paymentDate?: string;
  rows: Array<{
    employeeNumber: string;
    employeeName: string;
    nisNumber?: string | null;
    birNumber?: string | null;
    currencyCode: string;
    grossPay?: number;
    paye?: number;
    nisEmployee?: number;
    healthSurcharge?: number;
    netPay?: number;
    allocations: Array<{
      bankName: string;
      branchName?: string | null;
      accountNumber: string | null;
      accountName?: string | null;
      accountNumberMasked: string;
      amount: number;
      allocationKind: string;
    }>;
  }>;
}): string {
  const periodEnd = input.periodEnd ?? "";
  const run: PayrollDisbursementRunMeta = {
    runNumber: input.runNumber,
    periodKey: input.periodKey ?? "",
    periodEnd,
    paymentDate: input.paymentDate ?? periodEnd,
  };

  const rows = buildPayrollDisbursementRows({
    run,
    employees: input.rows.map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      nisNumber: row.nisNumber,
      birNumber: row.birNumber,
      currency: row.currencyCode,
      grossPay: row.grossPay ?? 0,
      paye: row.paye ?? 0,
      nisEmployee: row.nisEmployee ?? 0,
      healthSurcharge: row.healthSurcharge ?? 0,
      netPay: row.netPay ?? 0,
      allocations: row.allocations.map((line) => ({
        bankName: line.bankName,
        branchName: line.branchName ?? null,
        accountNumber: line.accountNumber ?? line.accountNumberMasked,
        accountName: line.accountName ?? null,
        splitType: line.allocationKind,
        allocationAmount: line.amount,
      })),
    })),
  });

  return buildPayrollDisbursementCsv(rows);
}

function sumLines(
  rows: Array<{ payslip: PayslipPreview }>,
  predicate: (label: string) => boolean,
): number {
  const amounts = rows.flatMap((row) =>
    row.payslip.deductions
      .filter((line) => predicate(line.label))
      .map((line) => line.amount),
  );
  return sumMoney(...amounts);
}

function sumEmployerNis(rows: Array<{ payslip: PayslipPreview }>): number {
  const amounts = rows.flatMap((row) =>
    row.payslip.employerContributions
      .filter((line) => line.label === "NIS (employer)")
      .map((line) => line.amount),
  );
  return sumMoney(...amounts);
}

export const PAYROLL_GL_MAPPING = [
  "5000 Salary expense: debit gross pay",
  "5050 Employer NIS expense: debit employer NIS",
  "2100 Net payroll payable: credit net pay",
  "2110 PAYE payable: credit PAYE deductions",
  "2120 NIS payable: credit employee + employer NIS",
  "2130 Health surcharge payable: credit Health Surcharge",
  "2190 Other payroll deductions payable: credit remaining employee deductions",
] as const;

export type GlJournalLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string;
};

/** Build balanced payroll journal lines (throws if debit ≠ credit). */
export function buildGlJournalLines(input: {
  rows: Array<{
    currency: string;
    grossPay: number;
    netPay: number;
    payslip: PayslipPreview;
  }>;
}): { currency: string; lines: GlJournalLine[]; totalDebit: number; totalCredit: number } {
  const gross = sumMoney(...input.rows.map((row) => row.grossPay));
  const net = sumMoney(...input.rows.map((row) => row.netPay));
  const employeeNis = sumLines(input.rows, (label) => label === "NIS (employee)");
  const paye = sumLines(input.rows, (label) => label === "PAYE (income tax)");
  const health = sumLines(input.rows, (label) => label === "Health Surcharge");
  const employerNis = sumEmployerNis(input.rows);
  const totalEmployeeDeductions = sumMoney(
    ...input.rows.map((row) => row.payslip.totalDeductions),
  );
  const otherDeductions = roundToCents(
    totalEmployeeDeductions - employeeNis - paye - health,
  );
  const currency = input.rows[0]?.currency ?? "TTD";

  const lines: GlJournalLine[] = [
    {
      accountCode: "5000",
      accountName: "Salary expense",
      debit: gross,
      credit: 0,
      memo: "Gross payroll",
    },
    {
      accountCode: "5050",
      accountName: "Employer NIS expense",
      debit: employerNis,
      credit: 0,
      memo: "Employer NIS",
    },
    {
      accountCode: "2100",
      accountName: "Net payroll payable",
      debit: 0,
      credit: net,
      memo: "Net pay due to employees",
    },
    {
      accountCode: "2110",
      accountName: "PAYE payable",
      debit: 0,
      credit: paye,
      memo: "PAYE withheld",
    },
    {
      accountCode: "2120",
      accountName: "NIS payable",
      debit: 0,
      credit: roundToCents(employeeNis + employerNis),
      memo: "Employee and employer NIS",
    },
    {
      accountCode: "2130",
      accountName: "Health surcharge payable",
      debit: 0,
      credit: health,
      memo: "Health surcharge withheld",
    },
  ];

  if (otherDeductions > 0) {
    lines.push({
      accountCode: "2190",
      accountName: "Other payroll deductions payable",
      debit: 0,
      credit: otherDeductions,
      memo: "Bank fixed / unpaid leave / other deductions",
    });
  }

  const totalDebit = sumMoney(...lines.map((line) => line.debit));
  const totalCredit = sumMoney(...lines.map((line) => line.credit));
  if (moneyDiffCents(totalDebit, totalCredit) !== 0) {
    throw new Error(
      `Payroll GL journal does not balance (debit ${totalDebit} ≠ credit ${totalCredit}).`,
    );
  }

  return { currency, lines, totalDebit, totalCredit };
}

export function buildGlJournalCsv(input: {
  runNumber: string;
  periodName: string;
  rows: Array<{
    currency: string;
    grossPay: number;
    netPay: number;
    payslip: PayslipPreview;
  }>;
}): string {
  const journal = buildGlJournalLines(input);
  const rows: Array<Array<string | number | null | undefined>> = [
    [
      "runNumber",
      "period",
      "accountCode",
      "accountName",
      "debit",
      "credit",
      "currency",
      "memo",
    ],
    ...journal.lines.map((line) => [
      input.runNumber,
      input.periodName,
      line.accountCode,
      line.accountName,
      line.debit > 0 ? line.debit.toFixed(2) : "",
      line.credit > 0 ? line.credit.toFixed(2) : "",
      journal.currency,
      line.memo,
    ]),
  ];

  return toCsv(rows);
}
