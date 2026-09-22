import type { Metadata } from "next";

import { getOrgEmployeeFileCompleteness } from "@/src/modules/hr/data/get-org-employee-file-completeness";
import { MissingDocumentsReportView } from "@/src/modules/reports/components/missing-documents-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const metadata: Metadata = {
  title: "Missing employee documents",
};

export const dynamic = "force-dynamic";

export default async function MissingDocumentsReportPage() {
  await requireReportAccess(findReportDefinition("missing-documents")!);
  const rows = await getOrgEmployeeFileCompleteness();

  return <MissingDocumentsReportView rows={rows} />;
}
