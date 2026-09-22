import type { Metadata } from "next";

import { getPayrollReadiness } from "@/src/modules/payroll/data/get-payroll-readiness";
import { PayrollReadinessPrintContent } from "@/src/modules/reports/components/print/phase1-report-print-content";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print payroll readiness",
};

export const dynamic = "force-dynamic";

export default async function PayrollReadinessPrintPage() {
  await requireReportAccess(findReportDefinition("payroll-readiness")!);
  const data = await getPayrollReadiness();

  return (
    <ReportPrintPage title="Payroll readiness export">
      <PayrollReadinessPrintContent data={data} />
    </ReportPrintPage>
  );
}
