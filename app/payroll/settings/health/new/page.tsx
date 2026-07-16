import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HealthSurchargeConfigForm } from "@/src/modules/payroll/components/health-surcharge-config-form";
import { getHealthSurchargeConfig } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "New Health Surcharge Config",
};

export const dynamic = "force-dynamic";

type NewHealthPageProps = {
  searchParams: Promise<{ copyFrom?: string }>;
};

export default async function NewHealthConfigPage({
  searchParams,
}: NewHealthPageProps) {
  await requirePayrollManageAccess();
  const { copyFrom } = await searchParams;
  const source = copyFrom ? await getHealthSurchargeConfig(copyFrom) : null;

  if (copyFrom && !source) {
    notFound();
  }

  return (
    <HealthSurchargeConfigForm
      config={source}
      sourceId={copyFrom ?? null}
      canManage
    />
  );
}
