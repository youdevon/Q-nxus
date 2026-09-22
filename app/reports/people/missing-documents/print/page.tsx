import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { getOrgEmployeeFileCompleteness } from "@/src/modules/hr/data/get-org-employee-file-completeness";
import { MissingDocumentsPrintContent } from "@/src/modules/reports/components/print/phase1-report-print-content";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";
import { ReportPrintPage } from "@/src/modules/reports/lib/report-print-page";

export const metadata: Metadata = {
  title: "Print missing employee documents",
};

export const dynamic = "force-dynamic";

export default async function MissingDocumentsPrintPage() {
  const capabilities = await requireReportAccess(
    findReportDefinition("missing-documents")!,
  );

  const user = await prisma.user.findUnique({
    where: { id: capabilities.userId },
    select: { organizationId: true },
  });

  if (!user) {
    return null;
  }

  const rows = await getOrgEmployeeFileCompleteness({
    organizationId: user.organizationId,
    incompleteOnly: true,
  });

  return (
    <ReportPrintPage title="Missing employee documents">
      <MissingDocumentsPrintContent rows={rows} />
    </ReportPrintPage>
  );
}
