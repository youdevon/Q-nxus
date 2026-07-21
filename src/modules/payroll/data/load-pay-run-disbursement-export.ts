import { prisma } from "@/lib/prisma";
import { decryptAccountNumber } from "@/src/modules/payroll/lib/bank-account-crypto";
import {
  buildPayrollDisbursementRows,
  buildPayrollDisbursementRowsFromPayslips,
  toIsoDateOnly,
  type PayrollDisbursementRow,
} from "@/src/modules/payroll/lib/payroll-disbursement-export";
import {
  isPayrollBankingFeatureEnabled,
  PAYROLL_BANKING_FEATURE_FLAGS,
  requiresVerifiedBankAccounts,
} from "@/src/modules/payroll/lib/payroll-banking-flags";
import { isPayRunPosted } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";

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

export type PayRunDisbursementExportResult =
  | {
      ok: true;
      run: {
        id: string;
        organizationId: string;
        runNumber: string;
      };
      rows: PayrollDisbursementRow[];
      source: "PAYMENT_ALLOCATIONS" | "PAYSLIP_SNAPSHOT";
    }
  | {
      ok: false;
      status: number;
      body: string | Record<string, unknown>;
    };

/**
 * Shared loader for Bank CSV / Disbursement Excel exports.
 */
export async function loadPayRunDisbursementExport(
  payRunId: string,
): Promise<PayRunDisbursementExportResult> {
  if (
    !(await isPayrollBankingFeatureEnabled(
      PAYROLL_BANKING_FEATURE_FLAGS.MANUAL_PAYMENT_ENABLED,
    ))
  ) {
    return {
      ok: false,
      status: 403,
      body: {
        error: "MANUAL_PAYMENT_DISABLED",
        message:
          "Manual bank payment export is disabled for this organization.",
      },
    };
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

  const run = await prisma.payRun.findUnique({
    where: { id: payRunId },
    include: {
      payrollPeriod: {
        select: {
          periodKey: true,
          periodEnd: true,
        },
      },
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
            select: {
              employeeNumber: true,
              employeeName: true,
              nisNumber: true,
              birNumber: true,
              grossPay: true,
              payeAmount: true,
              nisEmployeeAmount: true,
              healthSurchargeAmount: true,
              netPay: true,
            },
          },
        },
      },
    },
  });

  if (!run || !isPayRunPosted(run.status)) {
    return {
      ok: false,
      status: 404,
      body: "Posted pay run not found",
    };
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
      return {
        ok: false,
        status: 403,
        body: {
          error: "UNVERIFIED_BANK_ACCOUNTS",
          message:
            "Export blocked: one or more payment allocations use unverified bank accounts. Verify accounts or enable ALLOW_UNVERIFIED_BANK_ACCOUNTS.",
        },
      };
    }
  }

  const periodEnd = toIsoDateOnly(run.payrollPeriod.periodEnd);
  const runMeta = {
    runNumber: run.runNumber,
    periodKey: run.payrollPeriod.periodKey,
    periodEnd,
    paymentDate: periodEnd,
  };

  let rows: PayrollDisbursementRow[];
  let source: "PAYMENT_ALLOCATIONS" | "PAYSLIP_SNAPSHOT" = "PAYSLIP_SNAPSHOT";

  if (run.payrollPayments.length > 0) {
    source = "PAYMENT_ALLOCATIONS";
    rows = buildPayrollDisbursementRows({
      run: runMeta,
      employees: run.payrollPayments
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
          nisNumber: payment.payslip.nisNumber,
          birNumber: payment.payslip.birNumber,
          currency: payment.currencyCode,
          grossPay: Number(payment.payslip.grossPay.toString()),
          paye: Number(payment.payslip.payeAmount.toString()),
          nisEmployee: Number(payment.payslip.nisEmployeeAmount.toString()),
          healthSurcharge: Number(
            payment.payslip.healthSurchargeAmount.toString(),
          ),
          netPay: Number(payment.payslip.netPay.toString()),
          allocations: payment.allocations.map((allocation) => ({
            bankName: allocation.bankName,
            branchName: allocation.branchName,
            accountNumber:
              decryptAccountNumber(allocation.accountNumberEncrypted) ??
              allocation.accountNumberMasked,
            accountName: allocation.beneficiaryName,
            splitType: allocation.allocationKind,
            allocationAmount: Number(allocation.amount.toString()),
          })),
        })),
    });
  } else {
    const slipRows = run.payslips.flatMap((slip) => {
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
          nisNumber: slip.nisNumber,
          birNumber: slip.birNumber,
          currency: slip.currency,
          grossPay: Number(slip.grossPay.toString()),
          paye: Number(slip.payeAmount.toString()),
          nisEmployee: Number(slip.nisEmployeeAmount.toString()),
          healthSurcharge: Number(slip.healthSurchargeAmount.toString()),
          netPay: Number(slip.netPay.toString()),
          payslip: snapshot.payslip,
        },
      ];
    });
    rows = buildPayrollDisbursementRowsFromPayslips({
      run: runMeta,
      rows: slipRows,
    });
  }

  return {
    ok: true,
    run: {
      id: run.id,
      organizationId: run.organizationId,
      runNumber: run.runNumber,
    },
    rows,
    source,
  };
}
