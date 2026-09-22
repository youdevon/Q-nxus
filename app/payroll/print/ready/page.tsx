import type { Metadata } from "next";

import { PayslipBatchPrintView } from "@/src/modules/payroll/components/payslip-batch-print-view";
import { getReadyPayslipBatch } from "@/src/modules/payroll/data/get-ready-payslip-batch";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { parsePayRunPayeeGroup } from "@/src/modules/payroll/lib/pay-run-payee-group";
import { getPreviousPayslipPeriod } from "@/src/modules/payroll/lib/payslip-preview";

export const metadata: Metadata = {
  title: "Print ready payslips",
};

export const dynamic = "force-dynamic";

type ReadyPayslipsPrintPageProps = {
  searchParams: Promise<{
    period?: string;
    payeeGroup?: string;
  }>;
};

/**
 * Batch print for payroll-ready payees.
 * Default period = previous Trinidad calendar month (most recent completed month).
 */
export default async function ReadyPayslipsPrintPage({
  searchParams,
}: ReadyPayslipsPrintPageProps) {
  await requirePayrollViewAccess();
  const { period, payeeGroup: payeeGroupRaw } = await searchParams;
  const periodKey = period?.trim() || getPreviousPayslipPeriod();
  const payeeGroup = parsePayRunPayeeGroup(payeeGroupRaw);
  const batch = await getReadyPayslipBatch({
    periodKey,
    ...(payeeGroup ? { workforceCategories: [payeeGroup] } : {}),
  });

  const skippedNotes = batch.skipped.map(
    (row) => `${row.employeeName} (${row.employeeNumber}): ${row.reason}`,
  );

  if (batch.readyCount === 0) {
    return (
      <PayslipBatchPrintView
        title="Print ready payslips"
        subtitle="No payroll-ready people"
        documents={[]}
        skippedNotes={["No people are payroll-ready for this filter."]}
      />
    );
  }

  return (
    <PayslipBatchPrintView
      title={`Ready payslips · ${batch.periodLabel}`}
      subtitle={`${batch.documents.length} of ${batch.readyCount} ready · period ${batch.periodKey} · up to 3 per Letter`}
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
