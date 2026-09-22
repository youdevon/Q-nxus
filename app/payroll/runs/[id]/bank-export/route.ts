import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { loadPayRunDisbursementExport } from "@/src/modules/payroll/data/load-pay-run-disbursement-export";
import { buildPayrollDisbursementCsv } from "@/src/modules/payroll/lib/payroll-disbursement-export";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const capabilities = await getUserCapabilities();
  const canExportSensitive =
    capabilities?.can("payroll.manage") ||
    capabilities?.can("payroll.bank_accounts.view_sensitive");
  if (!capabilities || !canExportSensitive) {
    return new Response("Not found", { status: 404 });
  }

  const { id } = await params;
  const loaded = await loadPayRunDisbursementExport(id);
  if (!loaded.ok) {
    if (typeof loaded.body === "string") {
      return new Response(loaded.body, { status: loaded.status });
    }
    return Response.json(loaded.body, { status: loaded.status });
  }

  const csv = buildPayrollDisbursementCsv(loaded.rows);
  const lineCount = loaded.rows.length;

  const metadata = await getAuditRequestMetadata();
  await prisma.auditEvent.create({
    data: {
      userId: capabilities.userId,
      organizationId: loaded.run.organizationId,
      moduleKey: "payroll",
      action: "EXPORT",
      entityType: "PayRun",
      entityId: loaded.run.id,
      description: `Exported bank payment CSV for pay run ${loaded.run.runNumber} (${lineCount} payment line${lineCount === 1 ? "" : "s"}, source=${loaded.source}).`,
      newValues: {
        exportKind: "BANK",
        format: "csv",
        schemaVersion: 1,
        lineCount,
        source: loaded.source,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      clientHostName: metadata.clientHostName,
    },
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${loaded.run.runNumber}-bank-payments.csv"`,
    },
  });
}
