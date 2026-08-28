import type { Metadata } from "next";

import { PaymentExceptionsReportView } from "@/src/modules/reports/components/payment-exceptions-report";
import { getPaymentExceptionsReport } from "@/src/modules/reports/data/get-payment-exceptions-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Payment exceptions",
};

export const dynamic = "force-dynamic";

export default async function PaymentExceptionsReportPage() {
  await requireReportAccess(findReportDefinition("payment-exceptions")!);
  const data = await getPaymentExceptionsReport();

  return <PaymentExceptionsReportView data={data} />;
}
