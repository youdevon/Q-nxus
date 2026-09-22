import type { Metadata } from "next";

import { CreatePayPeriodForm } from "@/src/modules/payroll/components/create-pay-period-form";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { defaultMonthlyPeriodKey } from "@/src/modules/payroll/lib/pay-period";
import {
  PAY_RUN_PAYEE_GROUP_OPTIONS,
  type PayRunPayeeGroupValue,
} from "@/src/modules/payroll/lib/pay-run-payee-group";

export const metadata: Metadata = {
  title: "New pay period",
};

export const dynamic = "force-dynamic";

export default async function NewPayPeriodPage() {
  await requirePayrollManageAccess();
  const readiness = await getPayrollReadiness({
    includeFileCompleteness: false,
  });

  const readyCounts = Object.fromEntries(
    PAY_RUN_PAYEE_GROUP_OPTIONS.map((option) => [
      option.value,
      readiness.rows.filter(
        (row) => row.isReady && row.workforceCategory === option.value,
      ).length,
    ]),
  ) as Record<PayRunPayeeGroupValue, number>;

  return (
    <CreatePayPeriodForm
      defaultPeriodKey={defaultMonthlyPeriodKey()}
      readyCounts={readyCounts}
    />
  );
}
