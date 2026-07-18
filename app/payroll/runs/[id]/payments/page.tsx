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

  return (
    <PayRunPaymentsView
      data={data}
      canManage={capabilities.can("payroll.manage")}
    />
  );
}
