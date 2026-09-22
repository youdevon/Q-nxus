import { notFound } from "next/navigation";

import {
  getPayRunPaysheet,
  getPayRunPaysheetWorkbookData,
} from "@/src/modules/payroll/data/get-pay-run-paysheet";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import {
  buildPayRunPaysheetXlsx,
  payRunPaysheetXlsxFileName,
} from "@/src/modules/payroll/lib/paysheet-xlsx-export";
import {
  parseExportFormat,
  respondWithReportExport,
} from "@/src/modules/reports/lib/export-response";
import { buildPayRunPaysheetExportTable } from "@/src/modules/reports/lib/report-export-builders";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const capabilities = await requirePayrollViewAccess();
  const { id } = await context.params;
  const format = parseExportFormat(request);

  if (format === "xlsx") {
    const workbookData = await getPayRunPaysheetWorkbookData(id, {
      actorUserId: capabilities.userId,
    });

    if (!workbookData) {
      notFound();
    }

    const buffer = await buildPayRunPaysheetXlsx(workbookData);
    const fileName = payRunPaysheetXlsxFileName(workbookData);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
      },
    });
  }

  const data = await getPayRunPaysheet(id, {
    actorUserId: capabilities.userId,
  });

  if (!data) {
    notFound();
  }

  return respondWithReportExport({
    request,
    table: buildPayRunPaysheetExportTable(data),
    fileNameBase: `payroll-register-${data.runNumber}-${data.periodKey}`,
    organizationName: data.organizationName,
  });
}
