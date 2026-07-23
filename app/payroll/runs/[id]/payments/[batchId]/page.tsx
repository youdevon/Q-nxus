import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AchPaymentBatchDetailView } from "@/src/modules/payroll/components/pay-run-payments";
import { getAchPaymentBatchDetail } from "@/src/modules/payroll/data/get-payroll-payments";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Payment batch",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; batchId: string }>;
};

export default async function PayRunPaymentBatchPage({ params }: PageProps) {
  const [{ id, batchId }, capabilities] = await Promise.all([
    params,
    requirePayrollViewAccess(),
  ]);
  const batch = await getAchPaymentBatchDetail(
    id,
    batchId,
    capabilities.userId,
  );

  if (!batch) {
    notFound();
  }

  const canManage = capabilities.can("payroll.manage");
  const canPrepare =
    capabilities.can("payroll.payment_batches.prepare") || canManage;
  const canApprove =
    capabilities.can("payroll.payment_batches.approve") || canManage;
  const canExport =
    capabilities.can("payroll.payment_batches.export") || canManage;

  return (
    <AchPaymentBatchDetailView
      batch={batch}
      capabilities={{
        canApprove,
        canGenerate: canExport,
        canCancel: canPrepare,
        canRelease: canExport,
        canReconcile: canExport,
        canManageReturns:
          capabilities.can("payroll.payment_returns.manage") || canManage,
      }}
    />
  );
}
