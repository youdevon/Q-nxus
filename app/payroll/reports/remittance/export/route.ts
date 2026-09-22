import { getStatutoryRemittanceReport } from "@/src/modules/payroll/data/get-statutory-remittance";
import { requirePayrollViewAccess } from "@/src/modules/payroll/data/require-payroll-access";
import { respondWithReportExport } from "@/src/modules/reports/lib/export-response";
import { buildStatutoryRemittanceExportTable } from "@/src/modules/reports/lib/report-export-builders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePayrollViewAccess();

  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  const data = await getStatutoryRemittanceReport({
    periodKey: typeof month === "string" ? month : undefined,
  });

  return respondWithReportExport({
    request,
    table: buildStatutoryRemittanceExportTable(data),
    fileNameBase: `statutory-remittance-${data.selectedPeriodKey}`,
  });
}
