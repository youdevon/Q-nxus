import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";

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

function sumLines(
  rows: Array<{ payslip: PayslipPreview }>,
  predicate: (label: string) => boolean,
): number {
  const total = rows.reduce(
    (sum, row) =>
      sum +
      row.payslip.deductions
        .filter((line) => predicate(line.label))
        .reduce((lineSum, line) => lineSum + line.amount, 0),
    0,
  );
  return Math.round(total * 100) / 100;
}

function sumEmployerNis(rows: Array<{ payslip: PayslipPreview }>): number {
  const total = rows.reduce(
    (sum, row) =>
      sum +
      row.payslip.employerContributions
        .filter((line) => line.label === "NIS (employer)")
        .reduce((lineSum, line) => lineSum + line.amount, 0),
    0,
  );
  return Math.round(total * 100) / 100;
}

export const PAYROLL_GL_MAPPING = [
  "5000 Salary expense: debit gross pay",
  "5050 Employer NIS expense: debit employer NIS",
  "2100 Net payroll payable: credit net pay",
  "2110 PAYE payable: credit PAYE deductions",
  "2120 NIS payable: credit employee + employer NIS",
  "2130 Health surcharge payable: credit Health Surcharge",
] as const;

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
  const gross = Math.round(
    input.rows.reduce((sum, row) => sum + row.grossPay, 0) * 100,
  ) / 100;
  const net = Math.round(
    input.rows.reduce((sum, row) => sum + row.netPay, 0) * 100,
  ) / 100;
  const employeeNis = sumLines(input.rows, (label) => label === "NIS (employee)");
  const paye = sumLines(input.rows, (label) => label === "PAYE (income tax)");
  const health = sumLines(input.rows, (label) => label === "Health Surcharge");
  const employerNis = sumEmployerNis(input.rows);
  const currency = input.rows[0]?.currency ?? "TTD";
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
    [input.runNumber, input.periodName, "5000", "Salary expense", gross.toFixed(2), "", currency, "Gross payroll"],
    [input.runNumber, input.periodName, "5050", "Employer NIS expense", employerNis.toFixed(2), "", currency, "Employer NIS"],
    [input.runNumber, input.periodName, "2100", "Net payroll payable", "", net.toFixed(2), currency, "Net pay due to employees"],
    [input.runNumber, input.periodName, "2110", "PAYE payable", "", paye.toFixed(2), currency, "PAYE withheld"],
    [input.runNumber, input.periodName, "2120", "NIS payable", "", (employeeNis + employerNis).toFixed(2), currency, "Employee and employer NIS"],
    [input.runNumber, input.periodName, "2130", "Health surcharge payable", "", health.toFixed(2), currency, "Health surcharge withheld"],
  ];

  return toCsv(rows);
}
