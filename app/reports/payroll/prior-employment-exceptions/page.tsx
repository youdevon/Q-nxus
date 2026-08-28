import type { Metadata } from "next";

import { PriorEmploymentExceptionsReportView } from "@/src/modules/reports/components/prior-employment-exceptions-report";
import { getPriorEmploymentExceptionsReport } from "@/src/modules/reports/data/get-prior-employment-exceptions-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Prior-employment exceptions",
};

export const dynamic = "force-dynamic";

export default async function PriorEmploymentExceptionsReportPage() {
  await requireReportAccess(findReportDefinition("prior-employment-exceptions")!);
  const data = await getPriorEmploymentExceptionsReport();

  return <PriorEmploymentExceptionsReportView data={data} />;
}
