import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SelfServicePayslipHistory } from "@/src/modules/payroll/components/self-service-payslip-history";
import { getEmployeePostedPayslipHistory } from "@/src/modules/payroll/data/get-pay-runs";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Payslips",
};

export const dynamic = "force-dynamic";

export default async function MyPayslipHistoryPage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.can("people.profile.view_own") || !capabilities.employeeId) {
    redirect("/");
  }

  const history = await getEmployeePostedPayslipHistory(
    capabilities.employeeId,
    { all: true },
  );

  return (
    <SelfServicePayslipHistory
      items={history.items}
      emptyMessage="No posted payslips yet. Official history appears here after payroll posts a run."
      heading="Payslips"
    />
  );
}
