import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayRunPayslipsView } from "@/src/modules/payroll/components/pay-run-payslips-view";
import { getPayRunDetail } from "@/src/modules/payroll/data/get-pay-runs";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Pay run payslips",
};

export const dynamic = "force-dynamic";

type PayRunPayslipsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PayRunPayslipsPage({
  params,
}: PayRunPayslipsPageProps) {
  const [{ id }, capabilities] = await Promise.all([
    params,
    requirePayrollViewAccess(),
  ]);
  const run = await getPayRunDetail(id, { actorUserId: capabilities.userId });

  if (!run) {
    notFound();
  }

  return (
    <PayRunPayslipsView
      run={run}
      canManage={capabilities.can("payroll.manage")}
    />
  );
}
