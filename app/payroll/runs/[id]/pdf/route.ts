import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { getPayRunBatchPrint } from "@/src/modules/payroll/data/get-pay-runs";
import { renderPayslipsPdf } from "@/src/modules/payroll/lib/payslip-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const capabilities = await getUserCapabilities();
  if (
    !capabilities?.can("payroll.manage") &&
    !capabilities?.can("payroll.view")
  ) {
    return new Response("Not found", { status: 404 });
  }

  const { id } = await params;
  const batch = await getPayRunBatchPrint(id);

  if (!batch || batch.documents.length === 0) {
    return new Response("Posted pay run not found", { status: 404 });
  }

  const pdf = await renderPayslipsPdf(
    batch.documents.map((doc) => ({
      payslip: doc.payslip,
      meta: doc.meta,
      ytd: doc.ytd,
      ytdBreakdown: doc.ytdBreakdown,
      projectedTaxYearPosition: doc.projectedTaxYearPosition,
      isOfficial: doc.isOfficial,
    })),
  );

  const fileName = `${batch.runNumber}-payslips.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
