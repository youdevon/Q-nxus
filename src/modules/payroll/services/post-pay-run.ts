import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import {
  aggregateIncludedPayRunTotals,
  filterIncludedPayRunRows,
  type PayRunMembershipStatus,
} from "@/src/modules/payroll/lib/pay-run-membership";

type DecimalLike = { toString(): string };

export type PostPayRunServiceInput = {
  payRun: {
    id: string;
    runNumber: string;
    payrollPeriodId: string;
    payrollPeriod: { name: string };
    payslips: Array<{
      status: PayRunMembershipStatus;
      grossPay: DecimalLike;
      totalDeductions: DecimalLike;
      netPay: DecimalLike;
    }>;
  };
  actorUserId: string;
  postedAt: Date;
  metadata: AuditRequestMetadata;
};

function decimalNumber(value: DecimalLike): number {
  return Number(value.toString());
}

/**
 * Freeze a draft pay run: mark slips POSTED, close the period, audit.
 *
 * Single writer for posted snapshot immutability — draft calc paths
 * (`toPayslipCreateData` / `toPayslipRecalcUpdateData`) own column+JSON
 * dual-writes before this; post only flips status and does not recompute.
 */
export async function postPayRunInTransaction(
  transaction: Prisma.TransactionClient,
  input: PostPayRunServiceInput,
): Promise<{ employeeCount: number; excludedCount: number }> {
  const includedPayslips = filterIncludedPayRunRows(input.payRun.payslips);
  const totals = aggregateIncludedPayRunTotals(
    input.payRun.payslips.map((slip) => ({
      status: slip.status,
      grossPay: decimalNumber(slip.grossPay),
      totalDeductions: decimalNumber(slip.totalDeductions),
      netPay: decimalNumber(slip.netPay),
    })),
  );
  const excludedCount = input.payRun.payslips.length - includedPayslips.length;

  await transaction.payslip.updateMany({
    where: {
      payRunId: input.payRun.id,
      status: "DRAFT",
    },
    data: { status: "POSTED" },
  });

  await transaction.payRun.update({
    where: { id: input.payRun.id },
    data: {
      status: "POSTED",
      postedAt: input.postedAt,
      postedById: input.actorUserId,
      employeeCount: totals.employeeCount,
      totalGross: new PrismaNamespace.Decimal(totals.totalGross),
      totalDeductions: new PrismaNamespace.Decimal(totals.totalDeductions),
      totalNet: new PrismaNamespace.Decimal(totals.totalNet),
    },
  });

  await transaction.payrollPeriod.update({
    where: { id: input.payRun.payrollPeriodId },
    data: { status: "CLOSED" },
  });

  await recordAuditEvent(transaction, {
    userId: input.actorUserId,
    moduleKey: "payroll",
    action: "UPDATE",
    entityType: "PayRun",
    entityId: input.payRun.id,
    description: `Posted pay run ${input.payRun.runNumber} for ${input.payRun.payrollPeriod.name} (${totals.employeeCount} employees${
      excludedCount > 0 ? `, ${excludedCount} excluded` : ""
    }). Amounts are frozen.`,
    oldValues: { status: "DRAFT" },
    newValues: {
      status: "POSTED",
      postedAt: input.postedAt.toISOString(),
      employeeCount: totals.employeeCount,
      excludedCount,
    },
    ...input.metadata,
  });

  return {
    employeeCount: totals.employeeCount,
    excludedCount,
  };
}
