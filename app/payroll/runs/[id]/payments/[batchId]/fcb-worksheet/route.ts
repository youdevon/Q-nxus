import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import {
  FirstCitizensManualWorksheetAdapter,
  buildFirstCitizensManualWorkbook,
  mapDetailToFirstCitizensEntry,
  normalizeFirstCitizensStoredHeader,
  parseFirstCitizensConfiguration,
} from "@/src/modules/payroll/lib/first-citizens-export";
import { decryptAccountNumber } from "@/src/modules/payroll/lib/bank-account-crypto";
import { markAchPaymentBatchExported } from "@/src/modules/payroll/services/ach-payment-batch";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; batchId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const capabilities = await getUserCapabilities();
  const canDownload =
    capabilities?.can("payroll.manage") ||
    capabilities?.can("payroll.payment_batches.export") ||
    capabilities?.can("payroll.bank_accounts.view_sensitive");
  if (!capabilities || !canDownload) {
    return new Response("Not found", { status: 404 });
  }

  const { id: payRunId, batchId } = await params;
  const batch = await prisma.achPaymentBatch.findFirst({
    where: { id: batchId, payRunId },
    include: {
      bankExportProfile: true,
      payRun: {
        select: {
          runNumber: true,
          currency: true,
          organization: { select: { name: true } },
          payrollPeriod: {
            select: { periodEnd: true, periodKey: true, name: true },
          },
        },
      },
      details: {
        orderBy: [{ sequence: "asc" }],
        include: {
          payrollPaymentAllocation: {
            select: {
              accountNumberEncrypted: true,
              accountType: true,
              beneficiaryName: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    return new Response("Batch not found", { status: 404 });
  }

  const config = parseFirstCitizensConfiguration(
    batch.bankExportProfile.configurationJson,
  );
  const period = batch.payRun.payrollPeriod;
  const header = normalizeFirstCitizensStoredHeader({
    globalAddenda: batch.globalAddenda,
    entryDescription: batch.entryDescription,
    discretionaryData: batch.discretionaryData,
    purposeCode: batch.purposeCode,
    transactionType: batch.transactionType,
    period: {
      periodName: period.name,
      periodKey: period.periodKey,
      periodEnd: period.periodEnd,
    },
  });

  const globalAddenda = header.globalAddenda;
  const entryDescription = header.entryDescription;
  const discretionaryData = header.discretionaryData;
  const transactionType = header.transactionType;
  const purposeCode = header.purposeCode;

  const resolvedConfig = {
    ...config,
    globalAddenda,
    entryDescription,
    discretionaryData,
    defaultPurposeCode: purposeCode,
    transactionType,
  };

  const detailLines = batch.details.map((detail) => {
    let accountNumber: string | null = null;
    try {
      accountNumber = decryptAccountNumber(
        detail.payrollPaymentAllocation.accountNumberEncrypted,
      );
    } catch {
      accountNumber = null;
    }
    return {
      sequence: detail.sequence,
      employeeNumber: detail.employeeNumber,
      employeeName: detail.employeeName,
      bankName: detail.bankName,
      accountNumber: accountNumber ?? detail.accountNumberMasked,
      accountNumberMasked: detail.accountNumberMasked,
      amount: Number(detail.amount.toString()),
      currencyCode: detail.currencyCode,
      allocationKind: detail.allocationKind,
      beneficiaryName: detail.payrollPaymentAllocation.beneficiaryName,
      abaNumber: detail.abaNumber,
      accountType: detail.payrollPaymentAllocation.accountType,
      paymentType: detail.paymentType,
      purposeCode: detail.purposeCode ?? purposeCode,
      addenda: detail.addenda?.trim() || globalAddenda,
    };
  });

  const adapter = new FirstCitizensManualWorksheetAdapter();
  const validation = adapter.validate({
    batchNumber: batch.batchNumber,
    runNumber: batch.payRun.runNumber,
    currencyCode: batch.currencyCode || batch.payRun.currency,
    details: detailLines,
    configurationJson: resolvedConfig,
  });
  if (!validation.ok) {
    return new Response(validation.errors.join(" "), { status: 400 });
  }

  const entries = detailLines.map((detail) =>
    mapDetailToFirstCitizensEntry(detail, resolvedConfig, {
      abaNumber: detail.abaNumber,
      accountType: detail.accountType,
      paymentType: detail.paymentType,
      purposeCode: detail.purposeCode,
      addenda: detail.addenda,
    }),
  );

  const actor = await prisma.user.findUnique({
    where: { id: capabilities.userId },
    select: { firstName: true, lastName: true, email: true },
  });
  const exportedBy =
    actor != null
      ? `${actor.firstName} ${actor.lastName}`.trim() || actor.email
      : capabilities.userId;

  const periodEnd = period.periodEnd;
  const effectiveDateIso =
    batch.effectivePaymentDate?.toISOString().slice(0, 10) ??
    periodEnd.toISOString().slice(0, 10);

  const buffer = await buildFirstCitizensManualWorkbook({
    entries,
    control: {
      organizationName: batch.payRun.organization.name,
      payrollPeriod:
        period.name ||
        period.periodKey ||
        periodEnd.toISOString().slice(0, 10),
      effectiveDate: effectiveDateIso,
      debitAccountMasked:
        config.balanceAccountMasked?.trim() ||
        "•••• (set Balance Account on export profile)",
      employeeCount: new Set(batch.details.map((d) => d.employeeNumber)).size,
      entryCount: batch.details.length,
      batchTotal: Number(batch.controlTotalAmount.toString()),
      exportedBy,
      exportedAt: new Date().toISOString(),
      batchReference: batch.batchNumber,
      documentLabel:
        "First Citizens manual-entry worksheet (NOT a bank import file)",
      globalAddenda,
      discretionaryData,
      entryDescription,
      transactionType,
      purposeCode,
      currencyCode: batch.currencyCode || batch.payRun.currency,
    },
  });

  const audit = await getAuditRequestMetadata();
  await markAchPaymentBatchExported({
    batchId: batch.id,
    actorUserId: capabilities.userId,
    audit,
  });

  const fileName = `${batch.batchNumber}-fcb-manual-entry-worksheet.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fileName}"`,
      "x-qnxus-document-type": "fcb-manual-entry-worksheet",
    },
  });
}
