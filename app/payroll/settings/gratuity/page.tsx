import type { Metadata } from "next";

import { GratuityPolicyDirectory } from "@/src/modules/payroll/components/gratuity-policy-form";
import { getGratuityPolicies } from "@/src/modules/payroll/data/get-gratuity-policy";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Gratuity Policy",
};

export const dynamic = "force-dynamic";

export default async function GratuitySettingsPage() {
  const capabilities = await requirePayrollViewAccess();
  const policies = await getGratuityPolicies();

  return (
    <GratuityPolicyDirectory
      policies={policies}
      canManage={capabilities.can("payroll.manage")}
    />
  );
}
