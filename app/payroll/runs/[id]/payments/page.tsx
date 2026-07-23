import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayRunPaymentsView } from "@/src/modules/payroll/components/pay-run-payments";
import { getPayRunPaymentsPage } from "@/src/modules/payroll/data/get-payroll-payments";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Pay run payments",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PayRunPaymentsPage({ params }: PageProps) {
  const [{ id }, capabilities] = await Promise.all([
    params,
    requirePayrollViewAccess(),
  ]);
  const data = await getPayRunPaymentsPage(id);

  if (!data) {
    notFound();
  }

  const canPrepare =
    capabilities.can("payroll.payment_batches.prepare") ||
    capabilities.can("payroll.manage");
  const canCreateBatch = canPrepare;
  const canExportFiles =
    capabilities.can("payroll.payment_batches.export") ||
    capabilities.can("payroll.bank_accounts.view_sensitive") ||
    capabilities.can("payroll.manage");

  return (
    <PayRunPaymentsView
      data={data}
      capabilities={{
        canPrepare,
        canCreateBatch,
        canExportFiles,
      }}
    />
  );
}
