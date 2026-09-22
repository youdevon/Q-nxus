import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayslipPreviewView } from "@/src/modules/payroll/components/payslip-preview";
import { getStoredPayslip } from "@/src/modules/payroll/data/get-stored-payslip";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Payslip",
};

export const dynamic = "force-dynamic";

type StoredPayslipPageProps = {
  params: Promise<{ id: string; payslipId: string }>;
};

export default async function StoredPayslipPage({
  params,
}: StoredPayslipPageProps) {
  await requirePayrollViewAccess();
  const { id, payslipId } = await params;
  const result = await getStoredPayslip(payslipId);

  if (!result || result.payRunId !== id) {
    notFound();
  }

  return (
    <PayslipPreviewView
      payslip={result.payslip}
      meta={result.meta}
      ytd={result.ytd}
      ytdBreakdown={result.ytdBreakdown}
      projectedTaxYearPosition={result.projectedTaxYearPosition}
      backHref={`/payroll/runs/${result.payRunId}/payslips`}
      backLabel="Payslips"
      printHref={`/payroll/runs/${result.payRunId}/payslips/${result.id}/print`}
      printLabel="Print payslip"
      pdfHref={
        result.isPosted
          ? `/payroll/runs/${result.payRunId}/payslips/${result.id}/pdf`
          : undefined
      }
      title={result.isPosted ? "Posted payslip" : "Draft payslip"}
      description={`${result.payslip.employee.displayName} · ${result.periodName} · ${result.runNumber}`}
      isOfficial={result.isPosted}
    />
  );
}
