import { getOrganizationProfile } from "@/src/modules/admin/data/get-organization-profile";
import {
  buildCsvContent,
  csvDownloadResponse,
} from "@/src/modules/reports/lib/csv";
import {
  buildStyledReportXlsx,
  sanitizeReportFileName,
} from "@/src/modules/reports/lib/export-xlsx";
import {
  reportTableToCsvMatrix,
  type ReportExportTable,
} from "@/src/modules/reports/lib/report-export-table";

export type ReportExportFormat = "csv" | "xlsx";

export function parseExportFormat(request: Request): ReportExportFormat {
  const format = new URL(request.url).searchParams.get("format");
  return format === "xlsx" ? "xlsx" : "csv";
}

export async function buildReportExportResponse(input: {
  table: ReportExportTable;
  fileNameBase: string;
  format: ReportExportFormat;
  organizationName?: string | null;
}): Promise<Response> {
  const safeBase = sanitizeReportFileName(input.fileNameBase);
  const extension = input.format === "xlsx" ? "xlsx" : "csv";
  const fileName = `${safeBase}.${extension}`;

  if (input.format === "csv") {
    const { headers, rows } = reportTableToCsvMatrix(input.table);
    return csvDownloadResponse(fileName, headers, rows);
  }

  const organizationName =
    input.organizationName ??
    (await getOrganizationProfile())?.name ??
    null;

  const buffer = await buildStyledReportXlsx({
    organizationName,
    table: input.table,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}

/** Convenience when both formats share identical tabular content. */
export async function respondWithReportExport(input: {
  request: Request;
  table: ReportExportTable;
  fileNameBase: string;
}): Promise<Response> {
  const format = parseExportFormat(input.request);
  return buildReportExportResponse({
    table: input.table,
    fileNameBase: input.fileNameBase,
    format,
  });
}

export { buildCsvContent };
