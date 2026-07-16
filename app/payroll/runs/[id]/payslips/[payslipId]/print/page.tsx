import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayslipPrintView } from "@/src/modules/payroll/components/payslip-print-view";
import { getStoredPayslip } from "@/src/modules/payroll/data/get-pay-runs";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Print payslip",
};

export const dynamic = "force-dynamic";

type StoredPayslipPrintPageProps = {
  params: Promise<{ id: string; payslipId: string }>;
};

export default async function StoredPayslipPrintPage({
  params,
}: StoredPayslipPrintPageProps) {
  await requirePayrollViewAccess();
  const { id, payslipId } = await params;
  const result = await getStoredPayslip(payslipId);

  if (!result || result.payRunId !== id) {
    notFound();
  }

  return (
    <PayslipPrintView
      payslip={result.payslip}
      meta={result.meta}
      ytd={result.ytd}
      isOfficial={result.isPosted}
    />
  );
}
