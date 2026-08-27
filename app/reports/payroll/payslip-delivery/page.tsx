import type { Metadata } from "next";

import { PayslipDeliveryReportView } from "@/src/modules/reports/components/payslip-delivery-report";
import { getPayslipDeliveryReport } from "@/src/modules/reports/data/get-payslip-delivery-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Payslip delivery status",
};

export const dynamic = "force-dynamic";

export default async function PayslipDeliveryReportPage() {
  await requireReportAccess(findReportDefinition("payslip-delivery")!);
  const data = await getPayslipDeliveryReport();

  return <PayslipDeliveryReportView data={data} />;
}
