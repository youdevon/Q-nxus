import type { AuditFilters } from "@/src/modules/admin/data/get-audit-events";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditEventsForExport } from "@/src/modules/reports/data/get-audit-events-export";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildAuditEventsExportTable } from "@/src/modules/reports/lib/report-export-builders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const capabilities = await getUserCapabilities();
  if (!capabilities?.can("administration.view")) {
    return new Response("Not found", { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const filters: AuditFilters = {
    query: params.get("query") ?? undefined,
    moduleKey: params.get("moduleKey") ?? undefined,
    action: params.get("action") ?? undefined,
    entityType: params.get("entityType") ?? undefined,
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
  };

  const exportData = await getAuditEventsForExport(filters);
  const date = new Date().toISOString().slice(0, 10);

  return respondWithReportExport({
    request,
    table: buildAuditEventsExportTable(exportData),
    fileNameBase: `audit-trail-${date}`,
  });
}
