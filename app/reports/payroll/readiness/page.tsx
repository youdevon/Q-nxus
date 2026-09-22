import type { Metadata } from "next";

import { PayrollReadinessExportReport } from "@/src/modules/reports/components/payroll-readiness-export-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Payroll readiness export",
};

export const dynamic = "force-dynamic";

export default async function PayrollReadinessReportPage() {
  await requireReportAccess(findReportDefinition("payroll-readiness")!);
  const data = await getPayrollReadiness();

  return <PayrollReadinessExportReport data={data} />;
}
