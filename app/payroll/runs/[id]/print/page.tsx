import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayslipBatchPrintView } from "@/src/modules/payroll/components/payslip-batch-print-view";
import { getPayRunBatchPrint } from "@/src/modules/payroll/data/get-pay-runs";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Batch print payslips",
};

export const dynamic = "force-dynamic";

type PayRunPrintPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Multi-document print for all included/posted payslips in a posted pay run.
 * Use browser Print → Save as PDF for a multi-page PDF.
 */
export default async function PayRunPrintPage({
  params,
}: PayRunPrintPageProps) {
  await requirePayrollViewAccess();
  const { id } = await params;
  const batch = await getPayRunBatchPrint(id);

  if (!batch) {
    notFound();
  }

  return (
    <PayslipBatchPrintView
      title={`Pay run ${batch.runNumber} · ${batch.periodName}`}
      subtitle={`${batch.documents.length} included payslip${batch.documents.length === 1 ? "" : "s"} · Print / Save as PDF`}
      documents={batch.documents.map((doc) => ({
        key: doc.id,
        payslip: doc.payslip,
        meta: doc.meta,
        ytd: doc.ytd,
        ytdBreakdown: doc.ytdBreakdown,
        projectedTaxYearPosition: doc.projectedTaxYearPosition,
        isOfficial: doc.isOfficial,
      }))}
    />
  );
}
