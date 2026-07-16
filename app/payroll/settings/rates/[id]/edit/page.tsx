import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatutoryRateForm } from "@/src/modules/payroll/components/statutory-rate-form";
import { getStatutoryRate } from "@/src/modules/payroll/data/get-statutory-rates";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Edit Statutory Rate",
};

export const dynamic = "force-dynamic";

type EditStatutoryRatePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditStatutoryRatePage({
  params,
}: EditStatutoryRatePageProps) {
  await requirePayrollManageAccess();

  const { id } = await params;
  const rate = await getStatutoryRate(id);

  if (!rate) {
    notFound();
  }

  return <StatutoryRateForm rate={rate} />;
}
