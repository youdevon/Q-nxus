import type { Metadata } from "next";

import { PayeTaxDirectory } from "@/src/modules/payroll/components/paye-tax-config-form";
import { getPayeTaxConfigs } from "@/src/modules/payroll/data/get-paye-tax-config";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "PAYE Configuration",
};

export const dynamic = "force-dynamic";

export default async function PayeSettingsPage() {
  const capabilities = await requirePayrollViewAccess();
  const configs = await getPayeTaxConfigs();

  return (
    <PayeTaxDirectory
      configs={configs}
      canManage={capabilities.can("payroll.manage")}
    />
  );
}
