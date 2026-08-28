import type { Metadata } from "next";

import { PayslipDeliveryPrintContent } from "@/src/modules/reports/components/print/phase1-report-print-content";
import { getPayslipDeliveryReport } from "@/src/modules/reports/data/get-payslip-delivery-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print payslip delivery status",
};

export const dynamic = "force-dynamic";

export default async function PayslipDeliveryPrintPage() {
  await requireReportAccess(findReportDefinition("payslip-delivery")!);
  const data = await getPayslipDeliveryReport();

  return (
    <ReportPrintPage title="Payslip delivery status">
      <PayslipDeliveryPrintContent data={data} />
    </ReportPrintPage>
  );
}
