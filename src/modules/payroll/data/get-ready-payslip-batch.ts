import { getOrganizationProfile } from "@/src/modules/admin/data/get-organization-profile";
import { getEmployeePayslipPreview } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import {
  getPayslipYtdBreakdownBatch,
  getPreviewPayslipYtdBatch,
  payslipPreviewToYtdContribution,
} from "@/src/modules/payroll/data/get-payslip-ytd";
import { resolveStatutoryConfigBundle } from "@/src/modules/payroll/data/get-statutory-bundle";
import type { PayslipDocumentMeta } from "@/src/modules/payroll/data/get-employee-payslip-preview";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import {
  formatPayslipPeriodLabel,
  getPreviousPayslipPeriod,
  payslipPeriodToAsOfDate,
} from "@/src/modules/payroll/lib/payslip-preview";
import type {
  PayslipYtdBreakdown,
  PayslipYtdTotals,
} from "@/src/modules/payroll/lib/payslip-ytd";
import { toStatutoryAsOfKey } from "@/src/modules/payroll/lib/statutory-as-of";

export type ReadyPayslipBatchItem = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
  ytd: PayslipYtdTotals;
  ytdBreakdown: PayslipYtdBreakdown;
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

const PREVIEW_CONCURRENCY = 6;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Build printable preview documents for every payroll-ready employee.
 * Default period = previous Trinidad calendar month (most recent completed month).
 *
 * Shares statutory config + org name across the batch; previews run with
 * limited concurrency; YTD uses one batched year query.
 */
export async function getReadyPayslipBatch(options?: {
  periodKey?: string;
}): Promise<ReadyPayslipBatchResult> {
  const periodKey = options?.periodKey ?? getPreviousPayslipPeriod();
  const asOf = payslipPeriodToAsOfDate(periodKey) ?? undefined;
  const periodLabel = formatPayslipPeriodLabel(periodKey) ?? periodKey;
  const periodEnd = asOf ?? new Date();
  const statutoryAsOf = toStatutoryAsOfKey(periodEnd);

  const [readiness, statutoryBundle, organization] = await Promise.all([
    getPayrollReadiness({ includeFileCompleteness: false }),
    resolveStatutoryConfigBundle(statutoryAsOf),
    getOrganizationProfile(),
  ]);

  const organizationName =
    organization?.legalName?.trim() ||
    organization?.name?.trim() ||
    "Organization";

  const readyRows = readiness.rows.filter((row) => row.isReady);

  const previewResults = await mapPool(
    readyRows,
    PREVIEW_CONCURRENCY,
    async (row) => {
      const result = await getEmployeePayslipPreview(row.employeeId, {
        asOf,
        statutoryBundle,
        organizationName,
      });
      return { row, result };
    },
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

  const documentsWithYtd = successful.map((item) => {
    const ytd =
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
        taxableEarnings: item.payslip.monthlyTaxableEarnings,
      } satisfies PayslipYtdTotals);
    return { ...item, ytd };
  });

  const breakdownByEmployee = await getPayslipYtdBreakdownBatch(
    documentsWithYtd.map((item) => ({
      key: item.employeeId,
      employeeId: item.employeeId,
      currentEmployer: item.ytd,
    })),
  );

  const documents: ReadyPayslipBatchItem[] = documentsWithYtd.map((item) => ({
    ...item,
    ytdBreakdown:
      breakdownByEmployee.get(item.employeeId) ??
      ({
        year: item.ytd.year,
        prior: {
          taxableIncome: 0,
          paye: 0,
          nisEmployee: 0,
          healthSurcharge: 0,
          recordCount: 0,
        },
        currentEmployer: item.ytd,
        combined: {
          year: item.ytd.year,
          grossPay: item.ytd.grossPay,
          totalDeductions: item.ytd.totalDeductions,
          netPay: item.ytd.netPay,
          paye: item.ytd.paye,
          nisEmployee: item.ytd.nisEmployee,
          healthSurcharge: item.ytd.healthSurcharge,
          taxableEarnings: item.ytd.taxableEarnings,
          periodCount: item.ytd.periodCount,
        },
      } satisfies PayslipYtdBreakdown),
  }));

  return {
    periodKey,
    periodLabel,
    documents,
    skipped,
    readyCount: readyRows.length,
  };
}
