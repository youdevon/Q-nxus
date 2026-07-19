import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { getStoredPayslip } from "@/src/modules/payroll/data/get-stored-payslip";import { renderPayslipsPdf } from "@/src/modules/payroll/lib/payslip-pdf";

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
      isOfficial: result.isPosted,
    },
  ]);

  const fileName = `${result.runNumber}-${result.payslip.employee.employeeNumber}-payslip.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
