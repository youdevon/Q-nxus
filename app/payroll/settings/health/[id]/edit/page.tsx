import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HealthSurchargeConfigForm } from "@/src/modules/payroll/components/health-surcharge-config-form";
import { getHealthSurchargeConfig } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Edit Health Surcharge",
};

export const dynamic = "force-dynamic";

type EditHealthPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditHealthConfigPage({
  params,
}: EditHealthPageProps) {
  await requirePayrollManageAccess();
  const { id } = await params;
  const config = await getHealthSurchargeConfig(id);

  if (!config) {
    notFound();
  }

  return <HealthSurchargeConfigForm config={config} canManage />;
}
