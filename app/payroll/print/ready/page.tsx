import type { Metadata } from "next";

import { PayslipBatchPrintView } from "@/src/modules/payroll/components/payslip-batch-print-view";
import { getReadyPayslipBatch } from "@/src/modules/payroll/data/get-ready-payslip-batch";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { getPreviousPayslipPeriod } from "@/src/modules/payroll/lib/payslip-preview";

export const metadata: Metadata = {
  title: "Print ready payslips",
};

export const dynamic = "force-dynamic";

type ReadyPayslipsPrintPageProps = {
  searchParams: Promise<{
    period?: string;
  }>;
};

/**
 * Batch print for all payroll-ready employees.
 * Default period = previous Trinidad calendar month (most recent completed month).
 */
export default async function ReadyPayslipsPrintPage({
  searchParams,
}: ReadyPayslipsPrintPageProps) {
  await requirePayrollViewAccess();
  const { period } = await searchParams;
  const periodKey = period?.trim() || getPreviousPayslipPeriod();
  const batch = await getReadyPayslipBatch({ periodKey });

  const skippedNotes = batch.skipped.map(
    (row) => `${row.employeeName} (${row.employeeNumber}): ${row.reason}`,
  );

  if (batch.readyCount === 0) {
    return (
      <PayslipBatchPrintView
        title="Print ready payslips"
        subtitle="No payroll-ready employees"
        documents={[]}
        skippedNotes={["No employees are payroll-ready."]}
      />
    );
  }

  return (
    <PayslipBatchPrintView
      title={`Ready payslips · ${batch.periodLabel}`}
      subtitle={`${batch.documents.length} of ${batch.readyCount} ready · period ${batch.periodKey} (previous month default)`}
      documents={batch.documents.map((doc) => ({
        key: doc.employeeId,
        payslip: doc.payslip,
        meta: doc.meta,
        ytd: doc.ytd,
        ytdBreakdown: doc.ytdBreakdown,
        isOfficial: false,
      }))}
      skippedNotes={skippedNotes}
    />
  );
}
