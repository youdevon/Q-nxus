/**
 * Freeze / restore payslip preview payloads for pay-run posting.
 * Posted payslips must not recalculate from live master data.
 */

import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";

export type PayslipSnapshotPayload = {
  version: 1;
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
};

export type PayslipSnapshotTotals = {
  currency: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  baseSalary: number;
  allowancesTotal: number;
  monthlyTaxableEarnings: number;
  employeeNumber: string;
  employeeName: string;
  nisNumber: string | null;
  birNumber: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  payFrequency: string;
  paymentMethod: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPayslipLineItem(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.label === "string" &&
    typeof value.amount === "number" &&
    (value.detail === undefined || typeof value.detail === "string")
  );
}

function isPayslipPreview(value: unknown): value is PayslipPreview {
  if (!isRecord(value)) {
    return false;
  }

  if (!isRecord(value.employee) || !isRecord(value.period)) {
    return false;
  }

  if (
    typeof value.employee.id !== "string" ||
    typeof value.employee.employeeNumber !== "string" ||
    typeof value.employee.displayName !== "string"
  ) {
    return false;
  }

  if (
    typeof value.period.label !== "string" ||
    typeof value.currency !== "string" ||
    typeof value.grossPay !== "number" ||
    typeof value.totalDeductions !== "number" ||
    typeof value.netPay !== "number" ||
    !Array.isArray(value.earnings) ||
    !Array.isArray(value.deductions) ||
    !value.earnings.every(isPayslipLineItem) ||
    !value.deductions.every(isPayslipLineItem)
  ) {
    return false;
  }

  return true;
}

function isPayslipDocumentMeta(value: unknown): value is PayslipDocumentMeta {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.organizationName === "string" &&
    (value.jobTitle === null || typeof value.jobTitle === "string") &&
    (value.departmentName === null || typeof value.departmentName === "string")
  );
}

export function buildPayslipSnapshot(
  payslip: PayslipPreview,
  meta: PayslipDocumentMeta,
): PayslipSnapshotPayload {
  return {
    version: 1,
    payslip,
    meta,
  };
}

export function extractPayslipSnapshotTotals(
  payslip: PayslipPreview,
  meta: PayslipDocumentMeta,
): PayslipSnapshotTotals {
  return {
    currency: payslip.currency,
    grossPay: payslip.grossPay,
    totalDeductions: payslip.totalDeductions,
    netPay: payslip.netPay,
    baseSalary: payslip.baseSalary,
    allowancesTotal: payslip.allowancesTotal,
    monthlyTaxableEarnings: payslip.monthlyTaxableEarnings,
    employeeNumber: payslip.employee.employeeNumber,
    employeeName: payslip.employee.displayName,
    nisNumber: payslip.employee.nisNumber,
    birNumber: payslip.employee.birNumber,
    jobTitle: meta.jobTitle,
    departmentName: meta.departmentName,
    payFrequency: payslip.period.payFrequency,
    paymentMethod: payslip.period.paymentMethod,
  };
}

export function parsePayslipSnapshot(
  raw: unknown,
): PayslipSnapshotPayload | null {
  if (!isRecord(raw)) {
    return null;
  }

  if (raw.version !== 1) {
    return null;
  }

  if (!isPayslipPreview(raw.payslip) || !isPayslipDocumentMeta(raw.meta)) {
    return null;
  }

  return {
    version: 1,
    payslip: raw.payslip,
    meta: raw.meta,
  };
}

export function sumPayRunTotals(
  rows: Array<{
    grossPay: number;
    totalDeductions: number;
    netPay: number;
  }>,
): {
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
} {
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalGross += row.grossPay;
      acc.totalDeductions += row.totalDeductions;
      acc.totalNet += row.netPay;
      return acc;
    },
    { totalGross: 0, totalDeductions: 0, totalNet: 0 },
  );

  return {
    employeeCount: rows.length,
    totalGross: Math.round(totals.totalGross * 100) / 100,
    totalDeductions: Math.round(totals.totalDeductions * 100) / 100,
    totalNet: Math.round(totals.totalNet * 100) / 100,
  };
}
