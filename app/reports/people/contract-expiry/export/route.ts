import { getContractExpiryReport } from "@/src/modules/reports/data/get-contract-expiry-report";
import { requireReportAccess } from "@/src/modules/reports/data/require-reports-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildContractExpiryExportTable } from "@/src/modules/reports/lib/report-export-builders";
import { findReportDefinition } from "@/src/modules/reports/lib/report-definitions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess(findReportDefinition("contract-expiry")!);

  const window = new URL(request.url).searchParams.get("window") ?? undefined;
  const data = await getContractExpiryReport({ window });

  return respondWithReportExport({
    request,
    table: buildContractExpiryExportTable(data),
    fileNameBase:
      data.window === "all"
        ? "contract-expiry-all-upcoming"
        : `contract-expiry-${data.window}-days`,
  });
}
