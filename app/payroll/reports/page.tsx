import type { Metadata } from "next";

import { PayrollReportsHub } from "@/src/modules/payroll/components/payroll-reports-hub";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "Payroll reports",
};

export const dynamic = "force-dynamic";

export default async function PayrollReportsPage() {
  await requirePayrollViewAccess();

  return <PayrollReportsHub />;
}
