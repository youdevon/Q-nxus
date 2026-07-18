/**
 * Freeze / restore payslip preview payloads for pay-run posting.
 * Posted payslips must not recalculate from live master data.
 */

import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { sumMoney } from "@/src/modules/payroll/lib/money";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";

export type PayslipStatutorySnapshot = {
  payeConfigId: string | null;
  payeVersionLabel: string | null;
  payeEffectiveFrom: string | null;
  healthConfigId: string | null;
  healthVersionLabel: string | null;
  healthEffectiveFrom: string | null;
  nisVersionLabel: string | null;
  nisEffectiveFrom: string | null;
  nisClassCount: number;
};

export type PayslipSnapshotPayload = {
  version: 1 | 2;
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  /** Present on version 2+ — pins statutory config used at calculation time. */
  statutory?: PayslipStatutorySnapshot;
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

function isPayslipBankLine(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.bankName === "string" &&
    (value.accountNumber === undefined ||
      typeof value.accountNumber === "string") &&
    typeof value.accountNumberMasked === "string" &&
    typeof value.amount === "number" &&
    (value.kind === "FIXED" ||
      value.kind === "PERCENTAGE" ||
      value.kind === "REMAINDER")
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
    !value.deductions.every(isPayslipLineItem) ||
    !(
      value.bankDistribution === null ||
      (Array.isArray(value.bankDistribution) &&
        value.bankDistribution.every(isPayslipBankLine))
    )
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
  statutory?: PayslipStatutorySnapshot | null,
): PayslipSnapshotPayload {
  if (statutory) {
    return {
      version: 2,
      payslip,
      meta,
      statutory,
    };
  }

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
  return {
    employeeCount: rows.length,
    totalGross: sumMoney(...rows.map((row) => row.grossPay)),
    totalDeductions: sumMoney(...rows.map((row) => row.totalDeductions)),
    totalNet: sumMoney(...rows.map((row) => row.netPay)),
  };
}

/**
 * Post-invariant: denormalized payslip columns must match the frozen snapshot
 * JSON. Draft writers (`toPayslipCreateData` / `toPayslipRecalcUpdateData`) are
 * the only paths that dual-write; `postPayRunInTransaction` must not recompute.
 */
export function assertPayslipColumnsMatchSnapshot(input: {
  snapshot: unknown;
  columns: {
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    baseSalary: number;
    allowancesTotal: number;
    monthlyTaxableEarnings: number;
  };
}): boolean {
  const parsed = parsePayslipSnapshot(input.snapshot);
  if (!parsed) {
    return false;
  }

  const { payslip } = parsed;
  return (
    payslip.grossPay === input.columns.grossPay &&
    payslip.totalDeductions === input.columns.totalDeductions &&
    payslip.netPay === input.columns.netPay &&
    payslip.baseSalary === input.columns.baseSalary &&
    payslip.allowancesTotal === input.columns.allowancesTotal &&
    payslip.monthlyTaxableEarnings === input.columns.monthlyTaxableEarnings
  );
}

