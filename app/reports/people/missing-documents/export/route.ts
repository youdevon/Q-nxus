import { getOrgEmployeeFileCompleteness } from "@/src/modules/hr/data/get-org-employee-file-completeness";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildMissingDocumentsExportTable } from "@/src/modules/reports/lib/report-export-builders";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("missing-documents")!);
  const rows = await getOrgEmployeeFileCompleteness();
  const date = new Date().toISOString().slice(0, 10);

  return respondWithReportExport({
    request,
    table: buildMissingDocumentsExportTable(rows),
    fileNameBase: `missing-documents-${date}`,
  });
}
