import { Prisma } from "@/generated/prisma/client";

import {
  getEmployeePayslipPreview,
  type PayslipDocumentMeta,
} from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { payslipPreviewToYtdContribution } from "@/src/modules/payroll/data/get-payslip-ytd";
import { roundToCents, sumMoney } from "@/src/modules/payroll/lib/money";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import {
  buildPayslipSnapshot,
  extractPayslipSnapshotTotals,
  sumPayRunTotals,
  type PayslipSnapshotPayload,
} from "@/src/modules/payroll/lib/payslip-snapshot";

/**
 * Draft pay-run snapshot builders.
 *
 * Single writer for payslip dual-write: `toPayslipCreateData` /
 * `toPayslipRecalcUpdateData` write snapshot JSON + denormalized columns
 * together. `postPayRunInTransaction` freezes status and decrements
 * balance-tracked recurring items on REGULAR posts — it does not recompute
 * payslip amounts.
 *
 * CORRECTION runs (Phase B) use {@link buildCorrectionDeltaEmployeeSnapshot}
 * so the slip pays category deltas via CORRECTION_* lines — not a second
 * full-period reassembly. REGULAR / OFF_CYCLE keep {@link buildEmployeePayRunSnapshot}.
 */
export type PayRunEmployeeSnapshot = {
  employeeId: string;
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
  snapshot: PayslipSnapshotPayload;
  isReady: boolean;
  blockingIssues: string[];
};

export async function buildEmployeePayRunSnapshot(
  employeeId: string,
  asOf: Date,
  options?: {
    periodStart?: Date;
    periodEnd?: Date;
    lineItems?: Array<{
      lineType: "EARNING" | "DEDUCTION";
      code: string;
      label: string;
      amount: { toString(): string } | number;
      isTaxable: boolean;
      notes?: string | null;
    }>;
  },
): Promise<PayRunEmployeeSnapshot | null> {
  const result = await getEmployeePayslipPreview(employeeId, {
    asOf,
    periodStart: options?.periodStart,
    periodEnd: options?.periodEnd,
    variableEarnings: options?.lineItems
      ?.filter((line) => line.lineType === "EARNING")
      .map((line) => ({
        label: line.label,
        amount: Number(line.amount.toString()),
        isTaxable: line.isTaxable,
        detail: [
          line.code.replaceAll("_", " ").toLowerCase(),
          line.notes ?? "",
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    variableDeductions: options?.lineItems
      ?.filter((line) => line.lineType === "DEDUCTION")
      .map((line) => ({
        label: line.label,
        amount: Number(line.amount.toString()),
        detail: [
          line.code.replaceAll("_", " ").toLowerCase(),
          line.notes ?? "",
        ]
          .filter(Boolean)
          .join(" · "),
      })),
  });

  if (!result) {
    return null;
  }

  const { payslip, meta, statutory } = result;
  const totals = extractPayslipSnapshotTotals(payslip, meta);
  const snapshot = buildPayslipSnapshot(payslip, meta, statutory);

  return {
    employeeId,
    ...totals,
    snapshot,
    isReady: payslip.readiness.isReady,
    blockingIssues: payslip.readiness.blockingIssues,
  };
}

export function toPayslipCreateData(input: {
  organizationId: string;
  payRunId: string;
  payrollPeriodId: string;
  row: PayRunEmployeeSnapshot;
  status: "DRAFT" | "POSTED";
}): Prisma.PayslipCreateManyInput {
  const statutory = payslipPreviewToYtdContribution(input.row.snapshot.payslip);

  return {
    organizationId: input.organizationId,
    payRunId: input.payRunId,
    payrollPeriodId: input.payrollPeriodId,
    employeeId: input.row.employeeId,
    status: input.status,
    currency: input.row.currency,
    grossPay: new Prisma.Decimal(input.row.grossPay),
    totalDeductions: new Prisma.Decimal(input.row.totalDeductions),
    netPay: new Prisma.Decimal(input.row.netPay),
    payeAmount: new Prisma.Decimal(statutory.paye),
    nisEmployeeAmount: new Prisma.Decimal(statutory.nisEmployee),
    healthSurchargeAmount: new Prisma.Decimal(statutory.healthSurcharge),
    baseSalary: new Prisma.Decimal(input.row.baseSalary),
    allowancesTotal: new Prisma.Decimal(input.row.allowancesTotal),
    monthlyTaxableEarnings: new Prisma.Decimal(
      input.row.monthlyTaxableEarnings,
    ),
    employeeNumber: input.row.employeeNumber,
    employeeName: input.row.employeeName,
    nisNumber: input.row.nisNumber,
    birNumber: input.row.birNumber,
    jobTitle: input.row.jobTitle,
    departmentName: input.row.departmentName,
    payFrequency: input.row.payFrequency,
    paymentMethod: input.row.paymentMethod,
    snapshot: input.row.snapshot as unknown as Prisma.InputJsonValue,
  };
}

/** Amount + identity fields refreshed from a recalculated snapshot (exclusion fields untouched). */
export function toPayslipRecalcUpdateData(
  row: PayRunEmployeeSnapshot,
): Prisma.PayslipUpdateInput {
  const statutory = payslipPreviewToYtdContribution(row.snapshot.payslip);

  return {
    currency: row.currency,
    grossPay: new Prisma.Decimal(row.grossPay),
    totalDeductions: new Prisma.Decimal(row.totalDeductions),
    netPay: new Prisma.Decimal(row.netPay),
    payeAmount: new Prisma.Decimal(statutory.paye),
    nisEmployeeAmount: new Prisma.Decimal(statutory.nisEmployee),
    healthSurchargeAmount: new Prisma.Decimal(statutory.healthSurcharge),
    baseSalary: new Prisma.Decimal(row.baseSalary),
    allowancesTotal: new Prisma.Decimal(row.allowancesTotal),
    monthlyTaxableEarnings: new Prisma.Decimal(row.monthlyTaxableEarnings),
    employeeNumber: row.employeeNumber,
    employeeName: row.employeeName,
    nisNumber: row.nisNumber,
    birNumber: row.birNumber,
    jobTitle: row.jobTitle,
    departmentName: row.departmentName,
    payFrequency: row.payFrequency,
    paymentMethod: row.paymentMethod,
    snapshot: row.snapshot as unknown as Prisma.InputJsonValue,
  };
}

export function aggregatePayRunTotals(rows: PayRunEmployeeSnapshot[]) {
  return sumPayRunTotals(rows);
}

export type CorrectionDeltaLineInput = {
  lineType: "EARNING" | "DEDUCTION";
  code: string;
  label: string;
  amount: { toString(): string } | number;
  isTaxable: boolean;
  notes?: string | null;
};

/**
 * Build a delta-payment payslip from CORRECTION_* (and any manual) line items
 * only — no contract salary and no statutory re-engine. Used for CORRECTION
 * runs so posting/ACH pays the net difference vs the source run.
 */
export function buildCorrectionDeltaEmployeeSnapshot(input: {
  employeeId: string;
  currency: string;
  employeeNumber: string;
  employeeName: string;
  nisNumber: string | null;
  birNumber: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  payFrequency: string;
  paymentMethod: string;
  organizationName: string;
  periodLabel: string;
  periodAsOf: string;
  lineItems: CorrectionDeltaLineInput[];
  isReady?: boolean;
  blockingIssues?: string[];
}): PayRunEmployeeSnapshot {
  const earnings = input.lineItems
    .filter((line) => line.lineType === "EARNING")
    .map((line) => ({
      label: line.label,
      amount: roundToCents(Number(line.amount.toString())),
      detail: [
        line.code.replaceAll("_", " ").toLowerCase(),
        line.notes ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
    }));

  const deductions = input.lineItems
    .filter((line) => line.lineType === "DEDUCTION")
    .map((line) => ({
      label: line.label,
      amount: roundToCents(Number(line.amount.toString())),
      detail: [
        line.code.replaceAll("_", " ").toLowerCase(),
        line.notes ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
    }));

  const grossPay = roundToCents(sumMoney(...earnings.map((line) => line.amount)));
  const totalDeductions = roundToCents(
    sumMoney(...deductions.map((line) => line.amount)),
  );
  const netPay = roundToCents(grossPay - totalDeductions);

  const payslip: PayslipPreview = {
    employee: {
      id: input.employeeId,
      employeeNumber: input.employeeNumber,
      displayName: input.employeeName,
      nisNumber: input.nisNumber,
      birNumber: input.birNumber,
    },
    period: {
      label: input.periodLabel,
      asOf: input.periodAsOf,
      payFrequency: input.payFrequency,
      paymentMethod: input.paymentMethod,
    },
    currency: input.currency,
    earnings,
    baseSalary: 0,
    allowancesTotal: 0,
    grossPay,
    monthlyTaxableEarnings: 0,
    deductions,
    totalDeductions,
    netPay,
    employerContributions: [],
    bankDistribution: null,
    nis: null,
    paye: null,
    health: null,
    readiness: {
      isReady: input.isReady !== false,
      blockingIssues: input.blockingIssues ?? [],
      softWarnings: [],
    },
    warnings: [],
    notes: [
      "Correction delta payment — amounts are category differences vs the source posted run, not a full-period recalculation.",
    ],
  };

  const meta: PayslipDocumentMeta = {
    organizationName: input.organizationName,
    jobTitle: input.jobTitle,
    departmentName: input.departmentName,
  };

  const totals = extractPayslipSnapshotTotals(payslip, meta);
  const snapshot = buildPayslipSnapshot(payslip, meta);

  return {
    employeeId: input.employeeId,
    ...totals,
    snapshot,
    isReady: payslip.readiness.isReady,
    blockingIssues: payslip.readiness.blockingIssues,
  };
}
