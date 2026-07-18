import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import {
  getPreviewPayslipYtdBatch,
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
 *
 * Previews run in parallel; YTD uses one batched year query.
 */
export async function getReadyPayslipBatch(options?: {
  periodKey?: string;
}): Promise<ReadyPayslipBatchResult> {
  const periodKey = options?.periodKey ?? getPreviousPayslipPeriod();
  const asOf = payslipPeriodToAsOfDate(periodKey) ?? undefined;
  const periodLabel = formatPayslipPeriodLabel(periodKey) ?? periodKey;

  const readiness = await getPayrollReadiness();
  const readyRows = readiness.rows.filter((row) => row.isReady);

  const previewResults = await Promise.all(
    readyRows.map(async (row) => {
      const result = await getEmployeePayslipPreview(row.employeeId, { asOf });
      return { row, result };
    }),
  );

  const skipped: ReadyPayslipBatchResult["skipped"] = [];
  const successful: Array<{
    employeeId: string;
    employeeName: string;
    employeeNumber: string;
    payslip: PayslipPreview;
    meta: PayslipDocumentMeta;
  }> = [];

  for (const { row, result } of previewResults) {
    if (!result) {
      skipped.push({
        employeeId: row.employeeId,
        employeeName: row.displayName,
        employeeNumber: row.employeeNumber,
        reason: "Payslip preview could not be calculated.",
      });
      continue;
    }

    successful.push({
      employeeId: row.employeeId,
      employeeName: row.displayName,
      employeeNumber: row.employeeNumber,
      payslip: result.payslip,
      meta: result.meta,
    });
  }

  const ytdByEmployee = await getPreviewPayslipYtdBatch(
    successful.map((item) => ({
      employeeId: item.employeeId,
      periodKey,
      current: payslipPreviewToYtdContribution(item.payslip),
    })),
  );

  const documents: ReadyPayslipBatchItem[] = successful.map((item) => ({
    ...item,
    ytd:
      ytdByEmployee.get(item.employeeId) ??
      ({
        year: new Date().getFullYear(),
        periodCount: 1,
        grossPay: item.payslip.grossPay,
        totalDeductions: item.payslip.totalDeductions,
        netPay: item.payslip.netPay,
        paye: 0,
        nisEmployee: 0,
        healthSurcharge: 0,
      } satisfies PayslipYtdTotals),
  }));

  return {
    periodKey,
    periodLabel,
    documents,
    skipped,
    readyCount: readyRows.length,
  };
}
