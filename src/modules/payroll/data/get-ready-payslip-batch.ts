import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import {
  getPreviewPayslipYtd,
  payslipPreviewToYtdContribution,
} from "@/src/modules/payroll/data/get-payslip-ytd";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import {
  formatPayslipPeriodLabel,
  getPreviousPayslipPeriod,
  payslipPeriodToAsOfDate,
} from "@/src/modules/payroll/lib/payslip-preview";
import type { PayslipYtdTotals } from "@/src/modules/payroll/lib/payslip-ytd";

export type ReadyPayslipBatchItem = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd: PayslipYtdTotals;
};

export type ReadyPayslipBatchResult = {
  /** Period key used for the batch (previous Trinidad calendar month by default). */
  periodKey: string;
  periodLabel: string;
  documents: ReadyPayslipBatchItem[];
  /** Ready employees skipped because preview data could not be built. */
  skipped: Array<{
    employeeId: string;
    employeeName: string;
    employeeNumber: string;
    reason: string;
  }>;
  readyCount: number;
};

/**
 * Build printable preview documents for every payroll-ready employee.
 * Default period = previous Trinidad calendar month (most recent completed month).
 */
export async function getReadyPayslipBatch(options?: {
  periodKey?: string;
}): Promise<ReadyPayslipBatchResult> {
  const periodKey = options?.periodKey ?? getPreviousPayslipPeriod();
  const asOf = payslipPeriodToAsOfDate(periodKey) ?? undefined;
  const periodLabel =
    formatPayslipPeriodLabel(periodKey) ?? periodKey;

  const readiness = await getPayrollReadiness();
  const readyRows = readiness.rows.filter((row) => row.isReady);

  const documents: ReadyPayslipBatchItem[] = [];
  const skipped: ReadyPayslipBatchResult["skipped"] = [];

  for (const row of readyRows) {
    const result = await getEmployeePayslipPreview(row.employeeId, { asOf });

    if (!result) {
      skipped.push({
        employeeId: row.employeeId,
        employeeName: row.displayName,
        employeeNumber: row.employeeNumber,
        reason: "Payslip preview could not be calculated.",
      });
      continue;
    }

    const ytd = await getPreviewPayslipYtd({
      employeeId: row.employeeId,
      periodKey,
      current: payslipPreviewToYtdContribution(result.payslip),
    });

    documents.push({
      employeeId: row.employeeId,
      employeeName: row.displayName,
      employeeNumber: row.employeeNumber,
      payslip: result.payslip,
      meta: result.meta,
      ytd,
    });
  }

  return {
    periodKey,
    periodLabel,
    documents,
    skipped,
    readyCount: readyRows.length,
  };
}
