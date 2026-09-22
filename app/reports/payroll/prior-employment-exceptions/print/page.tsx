import type { Metadata } from "next";

import { PriorEmploymentExceptionsPrintContent } from "@/src/modules/reports/components/print/phase1-report-print-content";
import { getPriorEmploymentExceptionsReport } from "@/src/modules/reports/data/get-prior-employment-exceptions-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print prior-employment exceptions",
};

export const dynamic = "force-dynamic";

export default async function PriorEmploymentExceptionsPrintPage() {
  await requireReportAccess(findReportDefinition("prior-employment-exceptions")!);
  const data = await getPriorEmploymentExceptionsReport();

  return (
    <ReportPrintPage
      title="Prior-employment verification exceptions"
      metaLines={[`Tax year: ${data.taxYear}`]}
    >
      <PriorEmploymentExceptionsPrintContent data={data} />
    </ReportPrintPage>
  );
}
