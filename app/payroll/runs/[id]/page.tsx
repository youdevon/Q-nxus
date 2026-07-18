import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayRunDetailView } from "@/src/modules/payroll/components/pay-run-detail";
import { getPayRunPaymentStatusSummary } from "@/src/modules/payroll/data/get-payroll-payments";
import { getPayRunDetail } from "@/src/modules/payroll/data/get-pay-runs";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Pay run",
};

export const dynamic = "force-dynamic";

type PayRunPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PayRunPage({ params }: PayRunPageProps) {
  const [{ id }, capabilities] = await Promise.all([
    params,
    requirePayrollViewAccess(),
  ]);
  const [run, paymentSummary] = await Promise.all([
    getPayRunDetail(id, { actorUserId: capabilities.userId }),
    getPayRunPaymentStatusSummary(id),
  ]);

  if (!run) {
    notFound();
  }

  return (
    <PayRunDetailView
      run={run}
      canManage={capabilities.can("payroll.manage")}
      paymentSummary={paymentSummary}
    />
  );
}
