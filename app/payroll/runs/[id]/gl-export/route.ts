import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { buildGlJournalCsv } from "@/src/modules/payroll/lib/payroll-exports";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const capabilities = await getUserCapabilities();
  if (!capabilities?.can("payroll.manage")) {
    return new Response("Not found", { status: 404 });
  }

  const { id } = await params;
  const run = await prisma.payRun.findUnique({
    where: { id },
    include: {
      payrollPeriod: { select: { name: true } },
      payslips: {
        where: { status: "POSTED" },
        orderBy: [{ employeeName: "asc" }],
      },
    },
  });

  if (!run || !isPayRunPosted(run.status)) {
    return new Response("Posted pay run not found", { status: 404 });
  }

  const rows = run.payslips.flatMap((slip) => {
    const snapshot = parsePayslipSnapshot(slip.snapshot);
    if (!snapshot) {
      return [];
    }
    return [
      {
        currency: slip.currency,
        grossPay: Number(slip.grossPay.toString()),
        netPay: Number(slip.netPay.toString()),
        payslip: snapshot.payslip,
      },
    ];
  });
  const csv = buildGlJournalCsv({
    runNumber: run.runNumber,
    periodName: run.payrollPeriod.name,
    rows,
  });

  const metadata = await getAuditRequestMetadata();
  await prisma.auditEvent.create({
    data: {
      userId: capabilities.userId,
      moduleKey: "payroll",
      action: "EXPORT",
      entityType: "PayRun",
      entityId: run.id,
      description: `Exported GL journal CSV for pay run ${run.runNumber}.`,
      newValues: { exportKind: "GL", lineCount: rows.length },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      clientHostName: metadata.clientHostName,
    },
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${run.runNumber}-gl-journal.csv"`,
    },
  });
}
