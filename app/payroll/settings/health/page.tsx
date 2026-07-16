import type { Metadata } from "next";

import { HealthSurchargeDirectory } from "@/src/modules/payroll/components/health-surcharge-config-form";
import { getHealthSurchargeConfigs } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Health Surcharge",
};

export const dynamic = "force-dynamic";

export default async function HealthSettingsPage() {
  const capabilities = await requirePayrollViewAccess();
  const configs = await getHealthSurchargeConfigs();

  return (
    <HealthSurchargeDirectory
      configs={configs}
      canManage={capabilities.can("payroll.manage")}
    />
  );
}
