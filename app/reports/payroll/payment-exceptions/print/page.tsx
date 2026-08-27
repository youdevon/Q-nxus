import type { Metadata } from "next";

import { PaymentExceptionsPrintContent } from "@/src/modules/reports/components/print/phase1-report-print-content";
import { getPaymentExceptionsReport } from "@/src/modules/reports/data/get-payment-exceptions-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print payment exceptions",
};

export const dynamic = "force-dynamic";

export default async function PaymentExceptionsPrintPage() {
  await requireReportAccess(findReportDefinition("payment-exceptions")!);
  const data = await getPaymentExceptionsReport();

  return (
    <ReportPrintPage title="Payment exceptions">
      <PaymentExceptionsPrintContent data={data} />
    </ReportPrintPage>
  );
}
