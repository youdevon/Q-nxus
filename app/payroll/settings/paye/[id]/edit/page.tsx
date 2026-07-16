import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayeTaxConfigForm } from "@/src/modules/payroll/components/paye-tax-config-form";
import { getPayeTaxConfig } from "@/src/modules/payroll/data/get-paye-tax-config";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Edit PAYE Configuration",
};

export const dynamic = "force-dynamic";

type EditPayePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPayeConfigPage({
  params,
}: EditPayePageProps) {
  await requirePayrollManageAccess();
  const { id } = await params;
  const config = await getPayeTaxConfig(id);

  if (!config) {
    notFound();
  }

  return <PayeTaxConfigForm config={config} canManage />;
}
