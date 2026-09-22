import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayRunPaysheetView } from "@/src/modules/payroll/components/pay-run-paysheet-view";
import { getPayRunPaysheet } from "@/src/modules/payroll/data/get-pay-run-paysheet";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Payroll register",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PayRunPaysheetPage({ params }: PageProps) {
  const capabilities = await requirePayrollViewAccess();
  const { id } = await params;
  const data = await getPayRunPaysheet(id, {
    actorUserId: capabilities.userId,
  });

  if (!data) {
    notFound();
  }

  return <PayRunPaysheetView data={data} />;
}
