import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
  requiresVerifiedBankAccounts,
} from "@/src/modules/payroll/lib/payroll-banking-flags";
import {
  buildBankPaymentCsv,
  buildBankPaymentCsvFromPaymentAllocations,
} from "@/src/modules/payroll/lib/payroll-exports";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function netPayAllowed(
  netPay: number,
  allowZero: boolean,
  allowNegative: boolean,
): boolean {
  if (netPay < 0) {
    return allowNegative;
  }
  if (netPay === 0) {
    return allowZero;
  }
  return true;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const capabilities = await getUserCapabilities();
  const canExportSensitive =
    capabilities?.can("payroll.manage") ||
    capabilities?.can("payroll.bank_accounts.view_sensitive");
  if (!capabilities || !canExportSensitive) {
    return new Response("Not found", { status: 404 });
  }

  if (
    !(await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.MANUAL_PAYMENT_ENABLED,
    ))
  ) {
    return Response.json(
      {
        error: "MANUAL_PAYMENT_DISABLED",
        message:
          "Manual bank payment export is disabled for this organization.",
      },
      { status: 403 },
    );
  }

  const [allowZeroNet, allowNegativeNet, requireVerified] = await Promise.all([
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_ZERO_NET_PAY_EXPORT,
    ),
    isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.ALLOW_NEGATIVE_NET_PAY_EXPORT,
    ),
    requiresVerifiedBankAccounts(),
  ]);

  const { id } = await params;
  const run = await prisma.payRun.findUnique({
    where: { id },
    include: {
      payslips: {
        where: { status: "POSTED" },
        orderBy: [{ employeeName: "asc" }],
      },
      payrollPayments: {
        include: {
          allocations: {
            orderBy: [{ sequence: "asc" }],
            include: {
              employeeBankAccount: {
                select: { isVerified: true },
              },
            },
          },
          payslip: {
            select: { employeeNumber: true, employeeName: true },
          },
        },
      },
    },
  });

  if (!run || !isPayRunPosted(run.status)) {
    return new Response("Posted pay run not found", { status: 404 });
  }

  if (requireVerified) {
    const unverified = run.payrollPayments.some((payment) =>
      payment.allocations.some(
        (allocation) =>
          allocation.employeeBankAccount != null &&
          !allocation.employeeBankAccount.isVerified,
      ),
    );
    if (unverified) {
      return Response.json(
        {
          error: "UNVERIFIED_BANK_ACCOUNTS",
          message:
            "Export blocked: one or more payment allocations use unverified bank accounts. Verify accounts or enable ALLOW_UNVERIFIED_BANK_ACCOUNTS.",
        },
        { status: 403 },
      );
    }
  }

  const { decryptAccountNumber } = await import(
    "@/src/modules/payroll/lib/bank-account-crypto"
  );

  let csv: string;
  let lineCount = 0;
  let source: "PAYMENT_ALLOCATIONS" | "PAYSLIP_SNAPSHOT" =
    "PAYSLIP_SNAPSHOT";

  if (run.payrollPayments.length > 0) {
    source = "PAYMENT_ALLOCATIONS";
    const rows = run.payrollPayments
      .filter((payment) =>
        netPayAllowed(
          Number(payment.netPay.toString()),
          allowZeroNet,
          allowNegativeNet,
        ),
      )
      .map((payment) => ({
        employeeNumber: payment.payslip.employeeNumber,
        employeeName: payment.payslip.employeeName,
        currencyCode: payment.currencyCode,
        allocations: payment.allocations.map((allocation) => ({
          bankName: allocation.bankName,
          accountNumber: decryptAccountNumber(
            allocation.accountNumberEncrypted,
          ),
          accountNumberMasked: allocation.accountNumberMasked,
          amount: Number(allocation.amount.toString()),
          allocationKind: allocation.allocationKind,
        })),
      }));
    csv = buildBankPaymentCsvFromPaymentAllocations({
      runNumber: run.runNumber,
      rows,
    });
    lineCount = rows.reduce(
      (sum, row) =>
        sum + row.allocations.filter((line) => line.amount > 0).length,
      0,
    );
  } else {
    const rows = run.payslips.flatMap((slip) => {
      if (
        !netPayAllowed(
          Number(slip.netPay.toString()),
          allowZeroNet,
          allowNegativeNet,
        )
      ) {
        return [];
      }
      const snapshot = parsePayslipSnapshot(slip.snapshot);
      if (!snapshot) {
        return [];
      }
      return [
        {
          employeeNumber: slip.employeeNumber,
          employeeName: slip.employeeName,
          currency: slip.currency,
          payslip: snapshot.payslip,
        },
      ];
    });
    csv = buildBankPaymentCsv({ runNumber: run.runNumber, rows });
    lineCount = rows.reduce(
      (sum, row) =>
        sum +
        (row.payslip.bankDistribution ?? []).filter((line) => line.amount > 0)
          .length,
      0,
    );
  }

  const metadata = await getAuditRequestMetadata();
  await prisma.auditEvent.create({
    data: {
      userId: capabilities.userId,
      organizationId: run.organizationId,
      moduleKey: "payroll",
      action: "EXPORT",
      entityType: "PayRun",
      entityId: run.id,
      description: `Exported bank payment CSV for pay run ${run.runNumber} (${lineCount} payment line${lineCount === 1 ? "" : "s"}, source=${source}).`,
      newValues: {
        exportKind: "BANK",
        lineCount,
        source,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      clientHostName: metadata.clientHostName,
    },
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${run.runNumber}-bank-payments.csv"`,
    },
  });
}
