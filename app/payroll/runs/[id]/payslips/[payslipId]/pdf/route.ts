import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { getStoredPayslip } from "@/src/modules/payroll/data/get-stored-payslip";
import { renderPayslipsPdf } from "@/src/modules/payroll/lib/payslip-pdf";
import { sanitizeReportFileName } from "@/src/modules/reports/lib/export-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; payslipId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const capabilities = await getUserCapabilities();
  if (
    !capabilities?.can("payroll.manage") &&
    !capabilities?.can("payroll.view")
  ) {
    return new Response("Not found", { status: 404 });
  }

  const { id, payslipId } = await params;
  const result = await getStoredPayslip(payslipId);

  if (!result || result.payRunId !== id) {
    return new Response("Payslip not found", { status: 404 });
  }

  const pdf = await renderPayslipsPdf([
    {
      payslip: result.payslip,
      meta: result.meta,
      ytd: result.ytd,
      ytdBreakdown: result.ytdBreakdown,
      projectedTaxYearPosition: result.projectedTaxYearPosition,
      isOfficial: result.isPosted,
    },
  ]);

  const employeeName = result.payslip.employee.displayName.trim() || "Employee";
  const fileName = `${sanitizeReportFileName(
    `${employeeName}-${result.periodName}`,
  )}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
