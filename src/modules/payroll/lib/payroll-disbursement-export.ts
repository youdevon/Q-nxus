import ExcelJS from "exceljs";

import { toCsv } from "@/src/modules/payroll/lib/csv";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";

/** Stable schema for bank-website / future ISO adapter consumers. */
export const PAYROLL_DISBURSEMENT_SCHEMA_VERSION = 1 as const;

export const PAYROLL_DISBURSEMENT_COLUMNS = [
  "schemaVersion",
  "runNumber",
  "periodKey",
  "periodEnd",
  "paymentDate",
  "employeeNumber",
  "employeeName",
  "nisNumber",
  "birNumber",
  "currency",
  "grossPay",
  "paye",
  "nisEmployee",
  "healthSurcharge",
  "netPay",
  "bankName",
  "branchName",
  "accountNumber",
  "accountName",
  "splitType",
  "allocationAmount",
] as const;

export type PayrollDisbursementColumn =
  (typeof PAYROLL_DISBURSEMENT_COLUMNS)[number];

export type PayrollDisbursementRow = {
  schemaVersion: typeof PAYROLL_DISBURSEMENT_SCHEMA_VERSION;
  runNumber: string;
  periodKey: string;
  periodEnd: string;
  paymentDate: string;
  employeeNumber: string;
  employeeName: string;
  nisNumber: string | null;
  birNumber: string | null;
  currency: string;
  grossPay: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  netPay: number;
  bankName: string;
  branchName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  splitType: string;
  allocationAmount: number;
};

export type PayrollDisbursementAllocationInput = {
  bankName: string;
  branchName?: string | null;
  accountNumber: string | null;
  accountName?: string | null;
  splitType: string;
  allocationAmount: number;
};

export type PayrollDisbursementEmployeeInput = {
  employeeNumber: string;
  employeeName: string;
  nisNumber?: string | null;
  birNumber?: string | null;
  currency: string;
  grossPay: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  netPay: number;
  allocations: readonly PayrollDisbursementAllocationInput[];
};

export type PayrollDisbursementRunMeta = {
  runNumber: string;
  periodKey: string;
  /** ISO date (YYYY-MM-DD). */
  periodEnd: string;
  /** ISO date used as suggested payment / value date (defaults to period end). */
  paymentDate: string;
};

export type PayrollDisbursementSummary = {
  employeeCount: number;
  allocationCount: number;
  totalAllocationAmount: number;
  totalNetPay: number;
};

function isoDate(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

/**
 * One row per bank allocation with amount > 0 (schema v1).
 */
export function buildPayrollDisbursementRows(input: {
  run: PayrollDisbursementRunMeta;
  employees: readonly PayrollDisbursementEmployeeInput[];
}): PayrollDisbursementRow[] {
  const rows: PayrollDisbursementRow[] = [];

  for (const employee of input.employees) {
    for (const allocation of employee.allocations) {
      if (allocation.allocationAmount <= 0) {
        continue;
      }
      rows.push({
        schemaVersion: PAYROLL_DISBURSEMENT_SCHEMA_VERSION,
        runNumber: input.run.runNumber,
        periodKey: input.run.periodKey,
        periodEnd: input.run.periodEnd,
        paymentDate: input.run.paymentDate,
        employeeNumber: employee.employeeNumber,
        employeeName: employee.employeeName,
        nisNumber: employee.nisNumber?.trim() || null,
        birNumber: employee.birNumber?.trim() || null,
        currency: employee.currency,
        grossPay: employee.grossPay,
        paye: employee.paye,
        nisEmployee: employee.nisEmployee,
        healthSurcharge: employee.healthSurcharge,
        netPay: employee.netPay,
        bankName: allocation.bankName,
        branchName: allocation.branchName?.trim() || null,
        accountNumber: allocation.accountNumber,
        accountName: allocation.accountName?.trim() || null,
        splitType: allocation.splitType,
        allocationAmount: allocation.allocationAmount,
      });
    }
  }

  return rows;
}

export function summarizePayrollDisbursementRows(
  rows: readonly PayrollDisbursementRow[],
): PayrollDisbursementSummary {
  const employees = new Set(rows.map((row) => row.employeeNumber));
  let totalAllocationAmount = 0;
  const netByEmployee = new Map<string, number>();

  for (const row of rows) {
    totalAllocationAmount += row.allocationAmount;
    if (!netByEmployee.has(row.employeeNumber)) {
      netByEmployee.set(row.employeeNumber, row.netPay);
    }
  }

  let totalNetPay = 0;
  for (const net of netByEmployee.values()) {
    totalNetPay += net;
  }

  return {
    employeeCount: employees.size,
    allocationCount: rows.length,
    totalAllocationAmount: Math.round(totalAllocationAmount * 100) / 100,
    totalNetPay: Math.round(totalNetPay * 100) / 100,
  };
}

function moneyCell(value: number): string {
  return value.toFixed(2);
}

export function payrollDisbursementRowsToCsvMatrix(
  rows: readonly PayrollDisbursementRow[],
): Array<Array<string | number | null>> {
  return [
    [...PAYROLL_DISBURSEMENT_COLUMNS],
    ...rows.map((row) => [
      row.schemaVersion,
      row.runNumber,
      row.periodKey,
      row.periodEnd,
      row.paymentDate,
      row.employeeNumber,
      row.employeeName,
      row.nisNumber,
      row.birNumber,
      row.currency,
      moneyCell(row.grossPay),
      moneyCell(row.paye),
      moneyCell(row.nisEmployee),
      moneyCell(row.healthSurcharge),
      moneyCell(row.netPay),
      row.bankName,
      row.branchName,
      row.accountNumber,
      row.accountName,
      row.splitType,
      moneyCell(row.allocationAmount),
    ]),
  ];
}

export function buildPayrollDisbursementCsv(
  rows: readonly PayrollDisbursementRow[],
): string {
  return toCsv(payrollDisbursementRowsToCsvMatrix(rows));
}

/**
 * Build schema-v1 rows from payslip snapshots (fallback when payments not prepared).
 */
export function buildPayrollDisbursementRowsFromPayslips(input: {
  run: PayrollDisbursementRunMeta;
  rows: Array<{
    employeeNumber: string;
    employeeName: string;
    nisNumber?: string | null;
    birNumber?: string | null;
    currency: string;
    grossPay: number;
    paye: number;
    nisEmployee: number;
    healthSurcharge: number;
    netPay: number;
    payslip: PayslipPreview;
  }>;
}): PayrollDisbursementRow[] {
  return buildPayrollDisbursementRows({
    run: input.run,
    employees: input.rows.map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      nisNumber: row.nisNumber ?? row.payslip.employee.nisNumber,
      birNumber: row.birNumber ?? row.payslip.employee.birNumber,
      currency: row.currency,
      grossPay: row.grossPay,
      paye: row.paye,
      nisEmployee: row.nisEmployee,
      healthSurcharge: row.healthSurcharge,
      netPay: row.netPay,
      allocations: (row.payslip.bankDistribution ?? []).map((line) => ({
        bankName: line.bankName,
        branchName: null,
        accountNumber: line.accountNumber ?? line.accountNumberMasked,
        accountName: null,
        splitType: line.kind,
        allocationAmount: line.amount,
      })),
    })),
  });
}

export async function buildPayrollDisbursementXlsx(
  rows: readonly PayrollDisbursementRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Q-NXUS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Disbursements", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = PAYROLL_DISBURSEMENT_COLUMNS.map((header) => ({
    header,
    key: header,
    width: header === "employeeName" || header === "bankName" ? 24 : 14,
  }));

  const moneyKeys = new Set([
    "grossPay",
    "paye",
    "nisEmployee",
    "healthSurcharge",
    "netPay",
    "allocationAmount",
  ]);

  for (const row of rows) {
    const excelRow = sheet.addRow(row);
    for (const col of PAYROLL_DISBURSEMENT_COLUMNS) {
      if (!moneyKeys.has(col)) {
        continue;
      }
      const cell = excelRow.getCell(col);
      cell.numFmt = "#,##0.00";
    }
    const accountCell = excelRow.getCell("accountNumber");
    accountCell.numFmt = "@";
  }

  sheet.getRow(1).font = { bold: true };

  const summary = summarizePayrollDisbursementRows(rows);
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "metric", key: "metric", width: 28 },
    { header: "value", key: "value", width: 18 },
  ];
  summarySheet.addRows([
    { metric: "schemaVersion", value: PAYROLL_DISBURSEMENT_SCHEMA_VERSION },
    { metric: "runNumber", value: rows[0]?.runNumber ?? "" },
    { metric: "periodKey", value: rows[0]?.periodKey ?? "" },
    { metric: "periodEnd", value: rows[0]?.periodEnd ?? "" },
    { metric: "paymentDate", value: rows[0]?.paymentDate ?? "" },
    { metric: "employeeCount", value: summary.employeeCount },
    { metric: "allocationCount", value: summary.allocationCount },
    { metric: "totalAllocationAmount", value: summary.totalAllocationAmount },
    { metric: "totalNetPay", value: summary.totalNetPay },
  ]);
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getCell("B8").numFmt = "#,##0.00";
  summarySheet.getCell("B9").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function toIsoDateOnly(value: Date | string): string {
  return isoDate(value);
}
