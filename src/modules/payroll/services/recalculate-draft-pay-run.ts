import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import {
  buildEmployeePayRunSnapshot,
  toPayslipRecalcUpdateData,
  type PayRunEmployeeSnapshot,
} from "@/src/modules/payroll/lib/build-pay-run-snapshots";
import {
  moneyDiffCents,
  roundToCents,
  sumMoney,
} from "@/src/modules/payroll/lib/money";
import {
  aggregateIncludedPayRunTotals,
  filterIncludedPayRunRows,
  type PayRunMembershipStatus,
} from "@/src/modules/payroll/lib/pay-run-membership";
import { isPayRunMutable } from "@/src/modules/payroll/lib/pay-run-lifecycle";

type DecimalLike = { toString(): string };

export type RecalculateDraftPayRunInput = {
  payRun: {
    id: string;
    runNumber: string;
    status: string;
    payrollPeriod: {
      periodStart: Date;
      periodEnd: Date;
    };
    payslips: Array<{
      id: string;
      status: PayRunMembershipStatus;
      employeeId: string;
      employeeNumber: string;
      employeeName: string;
      grossPay: DecimalLike;
      totalDeductions: DecimalLike;
      netPay: DecimalLike;
      lineItems: Array<{
        lineType: "EARNING" | "DEDUCTION";
        code: string;
        label: string;
        amount: DecimalLike | number;
        isTaxable: boolean;
        notes?: string | null;
      }>;
    }>;
  };
  actorUserId: string;
  metadata: AuditRequestMetadata;
  /** When true, audit description notes forced pre-post refresh. */
  reason?: "manual" | "pre_post";
  /**
   * When false, leave approval fields untouched (used for pre-post refresh).
   * Caller must reject posting if figures changed.
   */
  clearApproval?: boolean;
};

export type RecalculateDraftPayRunResult =
  | {
      ok: true;
      employeeCount: number;
      excludedCount: number;
      totalGross: number;
      totalDeductions: number;
      totalNet: number;
      /** True when included net total changed vs pre-recalc values. */
      figuresChanged: boolean;
    }
  | { ok: false; message: string };

function decimalNumber(value: DecimalLike): number {
  return Number(value.toString());
}

/**
 * Rebuild included draft payslips from current master data + line items.
 * Used by manual Recalculate and automatically before Post (Wave A).
 */
export async function recalculateDraftPayRunCore(
  input: RecalculateDraftPayRunInput,
): Promise<RecalculateDraftPayRunResult> {
  if (!isPayRunMutable(input.payRun.status)) {
    return {
      ok: false,
      message: "Only draft or approved pay runs can be recalculated.",
    };
  }

  const included = filterIncludedPayRunRows(input.payRun.payslips);
  if (included.length === 0) {
    return {
      ok: false,
      message:
        "No included employees to recalculate. Re-include someone first, or create a new run.",
    };
  }

  const asOf = input.payRun.payrollPeriod.periodEnd;
  const snapshots: Array<{ payslipId: string; row: PayRunEmployeeSnapshot }> =
    [];
  const notReadyAtCalc: string[] = [];

  for (const slip of included) {
    const snapshot = await buildEmployeePayRunSnapshot(slip.employeeId, asOf, {
      periodStart: input.payRun.payrollPeriod.periodStart,
      periodEnd: input.payRun.payrollPeriod.periodEnd,
      lineItems: slip.lineItems,
    });

    if (!snapshot) {
      notReadyAtCalc.push(
        `${slip.employeeName} (${slip.employeeNumber}): employee record not found.`,
      );
      continue;
    }

    if (!snapshot.isReady) {
      notReadyAtCalc.push(
        `${snapshot.employeeName} (${snapshot.employeeNumber}): ${
          snapshot.blockingIssues.join(" ") || "Not payroll-ready."
        }`,
      );
      continue;
    }

    snapshots.push({ payslipId: slip.id, row: snapshot });
  }

  if (notReadyAtCalc.length > 0) {
    return {
      ok: false,
      message: [
        "Cannot recalculate — some included employees are not payroll-ready:",
        ...notReadyAtCalc.map((line) => `• ${line}`),
      ].join("\n"),
    };
  }

  const excludedCount = input.payRun.payslips.length - included.length;
  const clearApproval = input.clearApproval !== false;

  const priorTotals = aggregateIncludedPayRunTotals(
    input.payRun.payslips.map((slip) => ({
      status: slip.status,
      grossPay: decimalNumber(slip.grossPay),
      totalDeductions: decimalNumber(slip.totalDeductions),
      netPay: decimalNumber(slip.netPay),
    })),
  );

  try {
    const totals = await prisma.$transaction(async (transaction) => {
      for (const entry of snapshots) {
        await transaction.payslip.update({
          where: { id: entry.payslipId },
          data: toPayslipRecalcUpdateData(entry.row),
        });
      }

      const amountRows = input.payRun.payslips.map((slip) => {
        const refreshed = snapshots.find(
          (entry) => entry.payslipId === slip.id,
        );
        if (refreshed) {
          return {
            status: slip.status,
            grossPay: refreshed.row.grossPay,
            totalDeductions: refreshed.row.totalDeductions,
            netPay: refreshed.row.netPay,
          };
        }
        return {
          status: slip.status,
          grossPay: decimalNumber(slip.grossPay),
          totalDeductions: decimalNumber(slip.totalDeductions),
          netPay: decimalNumber(slip.netPay),
        };
      });

      const aggregated = aggregateIncludedPayRunTotals(amountRows);
      const figuresChanged =
        moneyDiffCents(priorTotals.totalNet, aggregated.totalNet) !== 0 ||
        moneyDiffCents(priorTotals.totalGross, aggregated.totalGross) !== 0 ||
        moneyDiffCents(
          priorTotals.totalDeductions,
          aggregated.totalDeductions,
        ) !== 0;

      // Cent-exact control: header totals must equal sum of included slip nets.
      const summedNet = sumMoney(
        ...amountRows
          .filter((row) => row.status !== "EXCLUDED")
          .map((row) => row.netPay),
      );
      if (moneyDiffCents(aggregated.totalNet, summedNet) !== 0) {
        throw new Error(
          `Pay run net total mismatch after recalculation (${aggregated.totalNet} vs ${summedNet}).`,
        );
      }

      await transaction.payRun.update({
        where: { id: input.payRun.id },
        data: {
          employeeCount: aggregated.employeeCount,
          totalGross: new Prisma.Decimal(roundToCents(aggregated.totalGross)),
          totalDeductions: new Prisma.Decimal(
            roundToCents(aggregated.totalDeductions),
          ),
          totalNet: new Prisma.Decimal(roundToCents(aggregated.totalNet)),
          ...(clearApproval || figuresChanged
            ? {
                status: "DRAFT",
                approvedAt: null,
                approvedById: null,
                approvalNote: null,
              }
            : {}),
        },
      });

      const reasonLabel =
        input.reason === "pre_post"
          ? "Forced recalculation before post"
          : "Recalculated draft pay run";

      await transaction.auditEvent.create({
        data: {
          userId: input.actorUserId,
          moduleKey: "payroll",
          action: "UPDATE",
          entityType: "PayRun",
          entityId: input.payRun.id,
          description: `${reasonLabel} ${input.payRun.runNumber} for ${aggregated.employeeCount} included employees${
            excludedCount > 0
              ? ` (${excludedCount} excluded preserved)`
              : ""
          }${figuresChanged ? " — figures changed" : " — figures unchanged"}.`,
          newValues: {
            employeeCount: aggregated.employeeCount,
            excludedCount,
            totalNet: aggregated.totalNet,
            totalGross: aggregated.totalGross,
            reason: input.reason ?? "manual",
            figuresChanged,
            approvalCleared: clearApproval || figuresChanged,
          },
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          clientHostName: input.metadata.clientHostName,
        },
      });

      return { ...aggregated, figuresChanged };
    });

    return {
      ok: true,
      employeeCount: totals.employeeCount,
      excludedCount,
      totalGross: totals.totalGross,
      totalDeductions: totals.totalDeductions,
      totalNet: totals.totalNet,
      figuresChanged: totals.figuresChanged,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not recalculate the pay run.",
    };
  }
}
