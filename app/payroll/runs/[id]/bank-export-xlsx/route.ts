import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { loadPayRunDisbursementExport } from "@/src/modules/payroll/data/load-pay-run-disbursement-export";
import { buildPayrollDisbursementXlsx } from "@/src/modules/payroll/lib/payroll-disbursement-export";

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

  const buffer = await buildPayrollDisbursementXlsx(loaded.rows);
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
      description: `Exported payroll disbursement Excel for pay run ${loaded.run.runNumber} (${lineCount} payment line${lineCount === 1 ? "" : "s"}, source=${loaded.source}).`,
      newValues: {
        exportKind: "BANK",
        format: "xlsx",
        schemaVersion: 1,
        lineCount,
        source: loaded.source,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      clientHostName: metadata.clientHostName,
    },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${loaded.run.runNumber}-payroll-disbursement.xlsx"`,
    },
  });
}
