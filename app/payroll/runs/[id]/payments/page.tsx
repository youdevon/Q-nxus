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
  searchParams: Promise<{ achError?: string | string[] }>;
};

export default async function PayRunPaymentsPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, capabilities, query] = await Promise.all([
    params,
    requirePayrollViewAccess(),
    searchParams,
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

  const achErrorRaw = query.achError;
  const achError =
    typeof achErrorRaw === "string" && achErrorRaw.trim()
      ? achErrorRaw.trim()
      : null;

  return (
    <PayRunPaymentsView
      data={data}
      achError={achError}
      capabilities={{
        canPrepare,
        canCreateBatch,
        canExportFiles,
      }}
    />
  );
}
