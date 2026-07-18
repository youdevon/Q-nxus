import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import { moneyDiffCents, roundToCents, sumMoney } from "@/src/modules/payroll/lib/money";

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function buildBankPaymentCsv(input: {
  runNumber: string;
  rows: Array<{
    employeeNumber: string;
    employeeName: string;
    currency: string;
    payslip: PayslipPreview;
  }>;
}): string {
  const rows: Array<Array<string | number | null | undefined>> = [
    [
      "runNumber",
      "employeeRef",
      "employeeName",
      "bankName",
      "accountNumber",
      "amount",
      "currency",
      "splitType",
    ],
  ];

  for (const row of input.rows) {
    for (const line of row.payslip.bankDistribution ?? []) {
      if (line.amount <= 0) {
        continue;
      }
      rows.push([
        input.runNumber,
        row.employeeNumber,
        row.employeeName,
        line.bankName,
        line.accountNumber ?? line.accountNumberMasked,
        line.amount.toFixed(2),
        row.currency,
        line.kind,
      ]);
    }
  }

  return toCsv(rows);
}

/** Prefer frozen PayrollPaymentAllocation snapshots when payments are prepared. */
export function buildBankPaymentCsvFromPaymentAllocations(input: {
  runNumber: string;
  rows: Array<{
    employeeNumber: string;
    employeeName: string;
    currencyCode: string;
    allocations: Array<{
      bankName: string;
      accountNumber: string | null;
      accountNumberMasked: string;
      amount: number;
      allocationKind: string;
    }>;
  }>;
}): string {
  const rows: Array<Array<string | number | null | undefined>> = [
    [
      "runNumber",
      "employeeRef",
      "employeeName",
      "bankName",
      "accountNumber",
      "amount",
      "currency",
      "splitType",
    ],
  ];

  for (const row of input.rows) {
    for (const line of row.allocations) {
      if (line.amount <= 0) {
        continue;
      }
      rows.push([
        input.runNumber,
        row.employeeNumber,
        row.employeeName,
        line.bankName,
        line.accountNumber ?? line.accountNumberMasked,
        line.amount.toFixed(2),
        row.currencyCode,
        line.allocationKind,
      ]);
    }
  }

  return toCsv(rows);
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
