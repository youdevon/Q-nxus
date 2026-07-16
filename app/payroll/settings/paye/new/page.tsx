import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayeTaxConfigForm } from "@/src/modules/payroll/components/paye-tax-config-form";
import { getPayeTaxConfig } from "@/src/modules/payroll/data/get-paye-tax-config";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "New PAYE Configuration",
};

export const dynamic = "force-dynamic";

type NewPayePageProps = {
  searchParams: Promise<{ copyFrom?: string }>;
};

export default async function NewPayeConfigPage({
  searchParams,
}: NewPayePageProps) {
  await requirePayrollManageAccess();
  const { copyFrom } = await searchParams;
  const source = copyFrom ? await getPayeTaxConfig(copyFrom) : null;

  if (copyFrom && !source) {
    notFound();
  }

  return (
    <PayeTaxConfigForm config={source} sourceId={copyFrom ?? null} canManage />
  );
}
