import type { Metadata } from "next";

import { CreatePayPeriodForm } from "@/src/modules/payroll/components/create-pay-period-form";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { defaultMonthlyPeriodKey } from "@/src/modules/payroll/lib/pay-period";

export const metadata: Metadata = {
  title: "New pay period",
};

export const dynamic = "force-dynamic";

export default async function NewPayPeriodPage() {
  await requirePayrollManageAccess();
  const readiness = await getPayrollReadiness();

  return (
    <CreatePayPeriodForm
      defaultPeriodKey={defaultMonthlyPeriodKey()}
      readyCount={readiness.readyCount}
    />
  );
}
