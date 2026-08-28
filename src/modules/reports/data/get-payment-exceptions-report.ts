import { prisma } from "@/lib/prisma";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";

export type PaymentExceptionKind =
  | "ALLOCATION_RETURNED"
  | "ALLOCATION_REJECTED"
  | "ALLOCATION_FAILED"
  | "PAYMENT_UNRECONCILED";

export type PaymentExceptionRow = {
  id: string;
  kind: PaymentExceptionKind;
  employeeNumber: string;
  employeeName: string;
  runNumber: string;
  bankName: string | null;
  accountMasked: string | null;
  amount: string;
  currency: string;
  status: string;
  returnReason: string | null;
  occurredAt: string | null;
};

export type PaymentExceptionsReport = {
  rows: PaymentExceptionRow[];
};

/** Failed/returned allocations and unreconciled posted payments. */
export async function getPaymentExceptionsReport(input?: {
  actorUserId?: string | null;
}): Promise<PaymentExceptionsReport> {
  const organizationId = (
    await resolvePayrollOrganization({ actorUserId: input?.actorUserId })
  ).id;

  const [allocations, unreconciledPayments] = await Promise.all([
    prisma.payrollPaymentAllocation.findMany({
      where: {
        status: { in: ["RETURNED", "REJECTED", "FAILED"] },
        payrollPayment: {
          organizationId,
          payRun: { status: { in: ["POSTED", "RECONCILED", "CLOSED"] } },
        },
      },
      orderBy: [{ returnedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        status: true,
        bankName: true,
        accountNumberMasked: true,
        amount: true,
        currencyCode: true,
        returnReason: true,
        returnedAt: true,
        updatedAt: true,
        payrollPayment: {
          select: {
            employee: {
              select: {
                employeeNumber: true,
                firstName: true,
                lastName: true,
              },
            },
            payRun: { select: { runNumber: true } },
          },
        },
      },
    }),
    prisma.payrollPayment.findMany({
      where: {
        organizationId,
        paymentStatus: "PAID",
        reconciledAt: null,
        payRun: { status: { in: ["POSTED", "RECONCILED", "CLOSED"] } },
      },
      orderBy: [{ paidAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        netPay: true,
        currencyCode: true,
        paidAt: true,
        updatedAt: true,
        paymentStatus: true,
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        payRun: { select: { runNumber: true } },
      },
    }),
  ]);

  const allocationRows: PaymentExceptionRow[] = allocations.map((row) => {
    const kind: PaymentExceptionKind =
      row.status === "REJECTED"
        ? "ALLOCATION_REJECTED"
        : row.status === "FAILED"
          ? "ALLOCATION_FAILED"
          : "ALLOCATION_RETURNED";

    return {
      id: row.id,
      kind,
      employeeNumber: row.payrollPayment.employee.employeeNumber,
      employeeName: `${row.payrollPayment.employee.firstName} ${row.payrollPayment.employee.lastName}`.trim(),
      runNumber: row.payrollPayment.payRun.runNumber,
      bankName: row.bankName,
      accountMasked: row.accountNumberMasked,
      amount: row.amount.toString(),
      currency: row.currencyCode,
      status: row.status,
      returnReason: row.returnReason,
      occurredAt: (row.returnedAt ?? row.updatedAt).toISOString(),
    };
  });

  const paymentRows: PaymentExceptionRow[] = unreconciledPayments.map((row) => ({
    id: row.id,
    kind: "PAYMENT_UNRECONCILED",
    employeeNumber: row.employee.employeeNumber,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
    runNumber: row.payRun.runNumber,
    bankName: null,
    accountMasked: null,
    amount: row.netPay.toString(),
    currency: row.currencyCode,
    status: row.paymentStatus,
    returnReason: null,
    occurredAt: (row.paidAt ?? row.updatedAt).toISOString(),
  }));

  return {
    rows: [...allocationRows, ...paymentRows],
  };
}
