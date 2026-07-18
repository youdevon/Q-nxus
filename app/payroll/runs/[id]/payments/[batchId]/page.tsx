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

  return (
    <AchPaymentBatchDetailView
      batch={batch}
      canManage={capabilities.can("payroll.manage")}
      canManageReturns={
        capabilities.can("payroll.payment_returns.manage") ||
        capabilities.can("payroll.manage")
      }
    />
  );
}
