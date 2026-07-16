import type { Metadata } from "next";

import { PayrollReadinessDirectory } from "@/src/modules/payroll/components/payroll-readiness-directory";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Payroll",
};

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const capabilities = await requirePayrollViewAccess();
  const data = await getPayrollReadiness();

  return (
    <PayrollReadinessDirectory
      data={data}
      canManage={capabilities.can("payroll.manage")}
    />
  );
}
