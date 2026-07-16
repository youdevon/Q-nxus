import type { Metadata } from "next";

import { StatutoryRateForm } from "@/src/modules/payroll/components/statutory-rate-form";
import { requirePayrollManageAccess } from "@/src/modules/payroll/data/require-payroll-access";

export const metadata: Metadata = {
  title: "New Statutory Rate",
};

export const dynamic = "force-dynamic";

export default async function NewStatutoryRatePage() {
  await requirePayrollManageAccess();

  return <StatutoryRateForm />;
}
